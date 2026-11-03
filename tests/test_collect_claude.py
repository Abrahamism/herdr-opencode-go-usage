"""Focused tests for collect_claude.py: parsing, formatting and credentials.

No network and no real credential store is touched: every payload and every
credential file here is synthetic. The shapes come from what Claude Code itself
caches in ~/.claude.json (`cachedUsageUtilization`) and from the documented
response of GET https://api.anthropic.com/api/oauth/usage.
"""

import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timezone

sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "mods",
        "opencode-usage",
    ),
)

import collect_claude  # noqa: E402


# Current shape: a `limits` array plus the named buckets the account also sends.
PAYLOAD_LIMITS = {
    "five_hour": {"utilization": 6, "resets_at": "2026-11-03T18:59:59Z"},
    "seven_day": {"utilization": 35, "resets_at": "2026-11-09T16:59:59Z"},
    "seven_day_opus": None,
    "seven_day_sonnet": {"utilization": 21, "resets_at": "2026-11-09T17:59:59Z"},
    "extra_usage": {"is_enabled": False, "monthly_limit": None, "used_credits": None},
    "limits": [
        {
            "kind": "session",
            "group": "session",
            "percent": 6,
            "severity": "normal",
            "resets_at": "2026-11-03T18:59:59Z",
            "scope": None,
            "is_active": True,
        },
        {
            "kind": "weekly_all",
            "group": "weekly",
            "percent": 35,
            "severity": "normal",
            "resets_at": "2026-11-09T16:59:59Z",
            "scope": None,
            "is_active": True,
        },
        {
            "kind": "weekly_sonnet",
            "group": "weekly",
            "percent": 21,
            "severity": "normal",
            "resets_at": "2026-11-09T17:59:59Z",
            "scope": None,
            "is_active": False,
        },
    ],
}

# Usage-billed account: the same windows, but with dollars instead of a percent.
PAYLOAD_DOLLARS = {
    "five_hour": {"used_dollars": 3.5, "limit_dollars": 25.0, "resets_at": "2026-11-03T18:59:59Z"},
    "seven_day": {"used_dollars": 41.25, "limit_dollars": 150.0, "resets_at": "2026-11-09T16:59:59Z"},
    "extra_usage": {"is_enabled": True, "monthly_limit": 200.0, "used_credits": 44.75},
}

NOW = datetime(2026, 11, 3, 16, 0, 0, tzinfo=timezone.utc)


class NormalizeTest(unittest.TestCase):
    def test_limits_array_names_the_plan_windows(self):
        record = collect_claude.normalize(PAYLOAD_LIMITS, "pro")
        self.assertEqual(record["provider"], "claude")
        self.assertEqual(record["plan"], "pro")
        self.assertEqual([w["label"] for w in record["windows"]], ["5h", "week", "sonnet"])
        self.assertEqual([w["key"] for w in record["windows"]], [
            "five_hour",
            "seven_day",
            "seven_day_sonnet",
        ])
        self.assertEqual(record["windows"][0]["percent"], 6.0)
        self.assertEqual(record["windows"][0]["resets_at"], "2026-11-03T18:59:59Z")
        # A disabled extra usage block is not money spent.
        self.assertIsNone(record["money"])

    def test_named_buckets_are_used_when_there_is_no_limits_array(self):
        payload = {key: PAYLOAD_LIMITS[key] for key in ("five_hour", "seven_day")}
        record = collect_claude.normalize(payload)
        self.assertEqual([w["label"] for w in record["windows"]], ["5h", "week"])
        self.assertEqual(record["windows"][1]["percent"], 35.0)

    def test_null_buckets_are_skipped_not_rendered_as_zero(self):
        payload = {
            "five_hour": PAYLOAD_LIMITS["five_hour"],
            "seven_day": PAYLOAD_LIMITS["seven_day"],
            "seven_day_opus": None,
            "seven_day_sonnet": None,
        }
        record = collect_claude.normalize(payload)
        self.assertEqual([w["label"] for w in record["windows"]], ["5h", "week"])

    def test_usage_billed_account_keeps_its_dollars(self):
        record = collect_claude.normalize(PAYLOAD_DOLLARS)
        five_h, week = record["windows"]
        self.assertIsNone(five_h["percent"])
        self.assertAlmostEqual(five_h["used_usd"], 3.5)
        self.assertAlmostEqual(five_h["limit_usd"], 25.0)
        self.assertAlmostEqual(week["used_usd"], 41.25)
        self.assertEqual(record["money"]["label"], "extra usage")
        self.assertAlmostEqual(record["money"]["used_usd"], 44.75)
        self.assertAlmostEqual(record["money"]["limit_usd"], 200.0)

    def test_extra_usage_alone_still_produces_a_reading(self):
        record = collect_claude.normalize({"extra_usage": {"is_enabled": True, "used_credits": 5}})
        self.assertEqual(record["windows"], [])
        self.assertAlmostEqual(record["money"]["used_usd"], 5.0)

    def test_a_payload_with_nothing_usable_is_an_error_not_an_empty_bar(self):
        with self.assertRaises(collect_claude.Unavailable) as ctx:
            collect_claude.normalize({"five_hour": None, "seven_day": None})
        self.assertEqual(ctx.exception.code, "no_usage")

    def test_a_payload_that_is_not_an_object_is_a_reader_error(self):
        with self.assertRaises(collect_claude.Unavailable) as ctx:
            collect_claude.normalize(["not", "an", "object"])
        self.assertEqual(ctx.exception.code, "reader_error")


class RenderTest(unittest.TestCase):
    def test_text_shows_percent_used_and_reset(self):
        text = collect_claude.render_text(collect_claude.normalize(PAYLOAD_LIMITS, "pro"), now=NOW)
        self.assertIn("Claude · plan pro", text)
        self.assertIn("6%", text)
        self.assertIn("35%", text)
        self.assertIn("2h 59m", text)  # 18:59:59Z minus 16:00:00Z
        self.assertIn("sonnet", text)

    def test_text_shows_dollars_for_a_usage_billed_account(self):
        text = collect_claude.render_text(collect_claude.normalize(PAYLOAD_DOLLARS), now=NOW)
        self.assertIn("$3.50", text)
        self.assertIn("of $25.00", text)
        self.assertIn("extra usage: used $44.75 of $200.00", text)

    def test_rendered_text_never_contains_a_credential(self):
        secret = "sk-ant-oat01-FAKE-CREDENTIAL-FOR-TESTS"
        payload = json.loads(json.dumps(PAYLOAD_LIMITS))
        payload["accessToken"] = secret
        payload["five_hour"]["token"] = secret
        record = collect_claude.normalize(payload)
        self.assertNotIn(secret, collect_claude.render_text(record, now=NOW))
        self.assertNotIn(secret, json.dumps(record))


class CountdownTest(unittest.TestCase):
    def test_formats_days_hours_and_minutes(self):
        self.assertEqual(collect_claude.countdown("2026-11-09T16:59:59Z", NOW), "6d 0h")
        self.assertEqual(collect_claude.countdown("2026-11-03T18:59:59Z", NOW), "2h 59m")
        self.assertEqual(collect_claude.countdown("2026-11-03T16:45:00Z", NOW), "45m")

    def test_past_reset_says_pending(self):
        self.assertEqual(collect_claude.countdown("2026-11-03T15:00:00Z", NOW), "reset pending")


class CredentialTest(unittest.TestCase):
    def _config_dir(self, payload=None):
        directory = tempfile.mkdtemp()
        if payload is not None:
            with open(os.path.join(directory, ".credentials.json"), "w", encoding="utf-8") as handle:
                json.dump(payload, handle)
        return directory

    def test_missing_credential_file_says_to_sign_in(self):
        with self.assertRaises(collect_claude.Unavailable) as ctx:
            collect_claude.read_credentials(self._config_dir())
        self.assertEqual(ctx.exception.code, "not_signed_in")
        self.assertIn("claude auth login", ctx.exception.action)

    def test_empty_token_is_not_signed_in(self):
        directory = self._config_dir(
            {
                "claudeAiOauth": {
                    "accessToken": "",
                    "refreshToken": "",
                    "expiresAt": 0,
                    "subscriptionType": "pro",
                }
            }
        )
        with self.assertRaises(collect_claude.Unavailable) as ctx:
            collect_claude.read_credentials(directory)
        self.assertEqual(ctx.exception.code, "not_signed_in")

    def test_live_session_returns_the_token_and_the_plan(self):
        directory = self._config_dir(
            {
                "claudeAiOauth": {
                    "accessToken": "sk-ant-oat01-test",
                    "refreshToken": "sk-ant-ort01-test",
                    "expiresAt": 4102444800000,  # 2100-01-01 in milliseconds
                    "subscriptionType": "max",
                }
            }
        )
        token, plan = collect_claude.read_credentials(directory)
        self.assertEqual(token, "sk-ant-oat01-test")
        self.assertEqual(plan, "max")

    def test_expired_session_in_milliseconds_asks_for_a_refresh(self):
        directory = self._config_dir(
            {"claudeAiOauth": {"accessToken": "sk-ant-oat01-test", "expiresAt": 1000000000000}}
        )
        with self.assertRaises(collect_claude.Unavailable) as ctx:
            collect_claude.read_credentials(directory)
        self.assertEqual(ctx.exception.code, "expired")
        self.assertIn("Claude Code", ctx.exception.action)

    def test_expired_session_in_seconds_is_also_detected(self):
        directory = self._config_dir(
            {"claudeAiOauth": {"accessToken": "sk-ant-oat01-test", "expiresAt": 1000000000}}
        )
        with self.assertRaises(collect_claude.Unavailable) as ctx:
            collect_claude.read_credentials(directory)
        self.assertEqual(ctx.exception.code, "expired")

    def test_reading_leaves_the_credential_file_untouched(self):
        directory = self._config_dir(
            {"claudeAiOauth": {"accessToken": "sk-ant-oat01-test", "expiresAt": 4102444800000}}
        )
        path = os.path.join(directory, ".credentials.json")
        with open(path, "rb") as handle:
            before = handle.read()
        collect_claude.read_credentials(directory)
        with open(path, "rb") as handle:
            after = handle.read()
        self.assertEqual(before, after)


# The company account in this machine: enterprise, no plan windows, one monthly
# credit pool. Real shape, values replaced by round numbers.
PAYLOAD_SPEND = {
    "five_hour": None,
    "seven_day": None,
    "limits": [],
    "extra_usage": {
        "is_enabled": True,
        "monthly_limit": 15000,
        "used_credits": 1250,
        "currency": "USD",
        "decimal_places": 2,
    },
    "spend": {
        "used": {"amount_minor": 1250, "currency": "USD", "exponent": 2},
        "limit": {"amount_minor": 15000, "currency": "USD", "exponent": 2},
        "percent": 8,
        "severity": "normal",
        "enabled": True,
    },
}


class SpendTest(unittest.TestCase):
    """The monthly credit pool: minor units, not dollars."""

    def test_spend_is_read_in_minor_units(self):
        record = collect_claude.normalize(PAYLOAD_SPEND, "enterprise")
        money = record["money"]
        self.assertEqual(record["windows"], [])
        self.assertEqual(money["label"], "month")
        self.assertAlmostEqual(money["used_usd"], 12.50)
        self.assertAlmostEqual(money["limit_usd"], 150.00)
        self.assertEqual(money["percent"], 8.0)

    def test_spend_wins_over_the_extra_usage_block(self):
        # Both describe the same pool; only `spend` carries the exponent.
        record = collect_claude.normalize(PAYLOAD_SPEND)
        self.assertAlmostEqual(record["money"]["limit_usd"], 150.00)

    def test_extra_usage_is_minor_units_when_it_declares_decimal_places(self):
        record = collect_claude.normalize(
            {
                "extra_usage": {
                    "is_enabled": True,
                    "monthly_limit": 15000,
                    "used_credits": 1250,
                    "decimal_places": 2,
                }
            }
        )
        self.assertEqual(record["money"]["label"], "extra usage")
        self.assertAlmostEqual(record["money"]["used_usd"], 12.50)
        self.assertAlmostEqual(record["money"]["limit_usd"], 150.00)

    def test_extra_usage_without_decimal_places_stays_in_dollars(self):
        record = collect_claude.normalize(
            {"extra_usage": {"is_enabled": True, "monthly_limit": 100.0, "used_credits": 12.5}}
        )
        self.assertAlmostEqual(record["money"]["limit_usd"], 100.0)
        self.assertAlmostEqual(record["money"]["used_usd"], 12.5)

    def test_rendered_money_groups_thousands_and_shows_the_percent(self):
        payload = {
            "spend": {
                "used": {"amount_minor": 250000, "exponent": 2},
                "limit": {"amount_minor": 1500000, "exponent": 2},
                "percent": 16.67,
                "enabled": True,
            }
        }
        text = collect_claude.render_text(collect_claude.normalize(payload), now=NOW)
        self.assertIn("used $2,500.00 of $15,000.00 (17%)", text)

    def test_a_disabled_spend_block_is_still_reported(self):
        payload = json.loads(json.dumps(PAYLOAD_SPEND))
        payload["spend"]["enabled"] = False
        record = collect_claude.normalize(payload)
        self.assertFalse(record["money"]["enabled"])


class MainTest(unittest.TestCase):
    """The CLI contract the mod consumes: exit code plus JSON on stdout."""

    def _run(self, argv):
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            code = collect_claude.main(argv)
        return code, buffer.getvalue()

    def test_json_error_exits_2_with_a_readable_record(self):
        code, output = self._run(["--json", "--config", tempfile.mkdtemp()])
        self.assertEqual(code, 2)
        record = json.loads(output)
        self.assertEqual(record["provider"], "claude")
        self.assertEqual(record["windows"], [])
        self.assertEqual(record["code"], "not_signed_in")
        self.assertIn("claude auth login", record["action"])


if __name__ == "__main__":
    unittest.main()
