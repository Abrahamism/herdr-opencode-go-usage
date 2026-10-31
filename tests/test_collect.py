"""Focused tests for collect.py: parsing, formatting and credential selection.

No network and no real credential store is touched: every payload and every
SQLite database here is synthetic.
"""

import json
import os
import sqlite3
import sys
import tempfile
import unittest
from datetime import datetime, timezone

sys.path.insert(
    0,
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mods", "opencode-usage"),
)

import collect  # noqa: E402


# Shape copied from a real 200 response of /console/api/go/status, values
# replaced by round numbers.
PAYLOAD = {
    "subscriberUserId": "acc_TEST",
    "product": "go",
    "renewalProduct": "go",
    "renewalCurrency": "usd",
    "cancelAtPeriodEnd": False,
    "access": {
        "startsAt": "2026-10-12T15:15:07.000Z",
        "endsAt": "2026-11-12T15:15:07.000Z",
        "meters": {
            "fiveHour": {
                "startsAt": "2026-10-31T15:42:52.000Z",
                "resetsAt": "2026-10-31T20:42:52.000Z",
                "limitMicroCents": "1200000000",
                "usedMicroCents": "240000000",
            },
            "week": {
                "startsAt": "2026-10-26T00:00:00.000Z",
                "resetsAt": "2026-11-02T00:00:00.000Z",
                "limitMicroCents": "3000000000",
                "usedMicroCents": "600000000",
            },
            "month": {
                "resetsAt": "2026-11-12T15:15:07.000Z",
                "limitMicroCents": "6000000000",
                "usedMicroCents": "3000000000",
            },
        },
    },
}

NOW = datetime(2026, 10, 31, 18, 30, 0, tzinfo=timezone.utc)


class NormalizeTest(unittest.TestCase):
    def test_windows_are_usd_and_percent_used(self):
        record = collect.normalize(PAYLOAD)
        self.assertEqual(record["provider"], "opencode-go")
        self.assertEqual(record["product"], "go")
        self.assertEqual([w["label"] for w in record["windows"]], ["5h", "week", "month"])
        five_h, week, month = record["windows"]
        self.assertAlmostEqual(five_h["limit_usd"], 12.0)
        self.assertAlmostEqual(five_h["used_usd"], 2.40)
        self.assertAlmostEqual(five_h["percent"], 20.0)
        self.assertAlmostEqual(week["percent"], 20.0)
        self.assertAlmostEqual(month["percent"], 50.0)
        self.assertEqual(month["resets_at"], "2026-11-12T15:15:07.000Z")

    def test_missing_or_zero_limit_does_not_crash_and_reports_no_percent(self):
        payload = {
            "access": {"meters": {"fiveHour": {"limitMicroCents": "0", "usedMicroCents": "10"}}}
        }
        record = collect.normalize(payload)
        five_h = record["windows"][0]
        self.assertIsNone(five_h["percent"])
        self.assertIsNone(five_h["limit_usd"])

    def test_payload_without_meters_is_an_error_not_an_empty_bar(self):
        with self.assertRaises(collect.Unavailable):
            collect.normalize({"product": "go"})


class RenderTest(unittest.TestCase):
    def test_text_shows_percent_used_and_limit(self):
        text = collect.render_text(collect.normalize(PAYLOAD), now=NOW)
        self.assertIn("OpenCode Go", text)
        self.assertIn("20.0%", text)
        self.assertIn("$2.40", text)
        self.assertIn("$12.00", text)
        self.assertIn("2h 12m", text)  # 20:42:52Z minus 18:30:00Z

    def test_rendered_text_never_contains_a_credential(self):
        secret = "FAKE-CREDENTIAL-FOR-TESTS"
        payload = json.loads(json.dumps(PAYLOAD))
        payload["access"]["token"] = secret
        payload["accessToken"] = secret
        text = collect.render_text(collect.normalize(payload), now=NOW)
        self.assertNotIn(secret, text)
        self.assertNotIn(secret, json.dumps(collect.normalize(payload)))


class CountdownTest(unittest.TestCase):
    def test_formats_days_hours_and_minutes(self):
        self.assertEqual(collect.countdown("2026-11-02T00:00:00.000Z", NOW), "1d 5h")
        self.assertEqual(collect.countdown("2026-10-31T20:42:52.000Z", NOW), "2h 12m")
        self.assertEqual(collect.countdown("2026-10-31T19:15:00.000Z", NOW), "45m")

    def test_past_reset_says_pending(self):
        self.assertEqual(collect.countdown("2026-10-31T18:00:00Z", NOW), "reset pending")


class CredentialTest(unittest.TestCase):
    def _db(self, rows):
        path = os.path.join(tempfile.mkdtemp(), "opencode.db")
        con = sqlite3.connect(path)
        con.execute(
            "create table credential (id text, integration_id text, label text, value text, active integer)"
        )
        con.executemany("insert into credential values (?,?,?,?,?)", rows)
        con.commit()
        con.close()
        return path

    def test_prefers_active_oauth_console_credential_over_api_keys(self):
        path = self._db(
            [
                ("c1", "opencode-go", "API key", '{"type":"key","key":"api-key-old"}', 0),
                ("c2", "opencode-go", "Trabajo", '{"type":"key","key":"api-key-active"}', 1),
                ("c3", "opencode", "Default", '{"type":"oauth","access":"st_ok","refresh":"rt"}', 1),
            ]
        )
        token = collect.read_access_token(path)
        self.assertEqual(token, "st_ok")

    def test_missing_console_login_explains_what_to_do(self):
        path = self._db([("c2", "opencode-go", "Trabajo", '{"type":"key","key":"api-key-x"}', 1)])
        with self.assertRaises(collect.Unavailable) as ctx:
            collect.read_access_token(path)
        self.assertIn("/connect", ctx.exception.action)

    def test_reading_is_read_only_and_leaves_the_database_untouched(self):
        path = self._db(
            [("c3", "opencode", "Default", '{"type":"oauth","access":"st_ok"}', 1)]
        )
        before = os.stat(path).st_size, os.stat(path).st_mtime_ns
        collect.read_access_token(path)
        after = os.stat(path).st_size, os.stat(path).st_mtime_ns
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
