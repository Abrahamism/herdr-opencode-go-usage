# Agent usage bar for Herdr

Your plan usage in Herdr's bottom bar: **OpenCode Go** (the rolling 5-hour window,
the UTC week and the paid month) and **Claude** (whatever the Claude Code session
on this machine reports: the five-hour session, the week, per-model windows, or
dollars when the account bills by use). The bar opens in the compact view, one
window per provider; clicking the numbers switches to every window, and clicking
the gauge opens a dialog with the details behind each number.

![The bar showing OpenCode Go and Claude in compact mode](preview.png)

Nothing here is estimated: the OpenCode numbers are the plan's own meters, and
the Claude numbers come from the same usage endpoint Claude Code's `/usage` view
uses.

## What you get

- **One chip group per provider**, separated by a middle dot:
  `OpenCode 5h 1% (1h 5m) · Claude 5h 12% (3h 40m)`.
- **Compact and full views.** Compact (the default) shows only each provider's
  five-hour window. One click on the numbers shows everything:
  `5h · week · month` for OpenCode, `5h · week · opus · sonnet` for Claude. The
  choice is remembered across restarts.
- **Countdowns in the bar**, so you know whether to start that long task now.
- **Percentages or dollars.** Claude accounts billed by use report a monthly
  money pool instead of plan windows; the bar shows `month $0.00 of $150.00 (0%)`
  with grouped thousands rather than inventing a percentage. Values are read in
  minor units and scaled by the exponent the payload declares.
- **A gauge icon that opens the detail dialog** (440×420): every window with its
  meter bar, `$used of $limit`, the exact local reset time, and the extra-usage
  pool when the account has one.
- **A refresh icon** next to the numbers, spinning while the reads are in flight.
- **Real errors** — OpenCode without a Console login, Claude Code signed out,
  expired session, wrong shape, no network: the bar shows `! OpenCode` or
  `! Claude` and the dialog says what to do next. No stale numbers are shown as
  if they were current.

## The dialog

![The detail dialog: one section per provider](dialog.png)

Click the numbers to switch views, the gauge to open this dialog. Each provider
gets its own section; `Refresh` asks the bar to read both again, `Esc` closes it.

## Requirements

- Herdr, with mods (tested on the Herdr app 0.7.1 / herdr-core 0.9.5).
- **OpenCode:** opencode v2, run at least once, with the **Console account**
  connected: in opencode run `/connect`, then `OpenCode Console account`. That
  login is what this reads; the inference API key in `auth.json` is not it.
- **Claude:** Claude Code signed in on this machine (`claude auth login`). The
  bar reads whichever account is signed in, and says so when there is none.
- Python 3 on `PATH` as `python`, `python3` or `py`.

## Install

Copy both mod folders into Herdr's mods directory:

```sh
cp -r mods/opencode-usage mods/opencode-usage-detail ~/.config/herdr-app/mods/
herdr-app check ~/.config/herdr-app/mods/opencode-usage
herdr-app check ~/.config/herdr-app/mods/opencode-usage-detail
```

Both must print `check passed`. Then put the bar in a layout you own — clone the
shipped one first, never edit it:

```sh
herdr-app do layout.clone '{"name":"main","as":"main-usage"}'
```

In `~/.config/herdr-app/layouts/main-usage.json`, replace the bottom `status`
block with a 28px row holding the bar and the status block:

```json
{
  "id": "footer",
  "type": "row",
  "size": { "px": 28 },
  "children": [
    {
      "id": "usage",
      "type": "block",
      "size": { "weight": 1.35 },
      "min": 340,
      "content": { "mod": "opencode-usage" }
    },
    {
      "id": "status",
      "type": "block",
      "size": { "weight": 1 },
      "content": { "mod": "workspace-status" }
    }
  ]
}
```

Saving a `.js` reloads a mod in place; `mod.json` and layout changes want an app
restart.

## Commands

| Command | What it does |
| --- | --- |
| `opencode-usage.refresh` | Read both providers again now |
| `opencode-usage.details` | Open the detail dialog |
| `opencode-usage.toggle` | Switch between the compact and full views |

Bind them to a key in `keys.json` if you like, or run them with
`herdr-app do opencode-usage.toggle`.

## Where the numbers come from

Two Python 3 scripts, standard library only, no dependencies. They are the only
parts that touch the network or a credential, and you can run them yourself:

```sh
python mods/opencode-usage/collect.py                 # OpenCode Go, human readable
python mods/opencode-usage/collect.py --json          # what the mod consumes
python mods/opencode-usage/collect.py --db <path>     # override the opencode database
python mods/opencode-usage/collect_claude.py          # Claude, human readable
python mods/opencode-usage/collect_claude.py --json   # what the mod consumes
python mods/opencode-usage/collect_claude.py --config <dir>   # override ~/.claude
```

**OpenCode Go.** `collect.py` reads the **OpenCode Console** OAuth credential
that opencode stores in its own database (`<data dir>/opencode.db`, table
`credential`, the row with `integration_id = 'opencode'` and `type: "oauth"`),
then asks `GET https://opencode.ai/console/api/go/status` for the plan meters.
They arrive as `limitMicroCents` / `usedMicroCents` (1e8 microcents = 1 USD), so
the percentage is exact and no plan tier is hardcoded.

**Claude.** `collect_claude.py` reads the OAuth token Claude Code keeps in
`<config dir>/.credentials.json` (`~/.claude` unless `CLAUDE_CONFIG_DIR` says
otherwise) and asks `GET https://api.anthropic.com/api/oauth/usage` with the
`anthropic-beta: oauth-2025-04-20` header — the same call behind Claude Code's
`/usage`. It accepts both shapes the endpoint has used: a `limits` array
(`session`, `weekly_all`, `weekly_opus`, `weekly_sonnet`) and the named buckets
(`five_hour`, `seven_day`, …). Each window keeps its `utilization` when the
account reports one and its `used_dollars` / `limit_dollars` when it bills by
use.

A usage-billed account usually reports no windows at all, only a `spend` block
for the month: `{"used": {"amount_minor": 1250, "exponent": 2}, "limit": {…}}`.
Those numbers are **minor units**, so `amount_minor: 15000` with `exponent: 2` is
**$150.00**, not $15,000.00. The same care applies to `extra_usage`, which
arrives in minor units when it carries `decimal_places` and in dollars when it
does not. `spend` wins over `extra_usage` when both are present, because only
`spend` states its exponent.

Both print a normalized record and exit `0`, or an error record with `windows: []`,
`error`, `code` and `action` and exit `2` for a known condition (no login,
expired session, offline, no database).

## Security and privacy

This is the part worth checking before you install it:

- The OpenCode database is opened **read-only** (`file:...?mode=ro`) and never
  written; the WAL is not checkpointed. Claude's credential file is only read.
- Each token is used **only** as an `Authorization` header towards its own
  provider. Neither is printed, logged, stored or copied into Herdr's shared
  state.
- Neither refresh token is ever touched. Re-authenticating is opencode's and
  Claude Code's job: rotating a refresh token would break those logins.
- The mod publishes a **sanitized** snapshot (labels, percentages, dollars,
  reset times) to Herdr's shared state. Tests assert a credential cannot reach
  the rendered output.
- Nothing is sent anywhere else, and nothing is collected. There is no telemetry
  and no account identity in any output.
- `opencode.db` may be large; only two columns of one row are read.

## Limitations

- One account per provider: whichever login opencode and Claude Code have stored.
- The OpenCode Console device login lasts about 30 days; the Claude Code session
  is refreshed by Claude Code itself. When either lapses the bar says so and the
  dialog names the next step. This mod deliberately never refreshes either.
- Both endpoints are internal and undocumented: they can change without notice.
  When they do, the bar shows a specific reason instead of wrong numbers.
- Claude usage is read from **this machine's session**, so it describes the
  account signed in here, not the whole organization. For an organization-wide
  spend report you would need the Admin API and an `sk-ant-admin` key, which this
  mod does not use.
- The numbers describe the plan or the account, not the harness: any agent using
  that API key or that login shows up in them.

## Cost

Measured on Windows: one provider read is about 440 ms, of which ~300 ms is
waiting on HTTPS and ~30 ms is interpreter startup; the two run one after the
other on the same 120 s timer, so a full read is under a second. The bar redraws
once a minute to move the countdowns. `REFRESH_MS` in `mods/opencode-usage/main.js`
is the only knob worth turning.

## Development

```sh
python -m unittest discover -s tests -v            # 35 offline tests
herdr-app check mods/opencode-usage                # bar
herdr-app check mods/opencode-usage-detail         # dialog
herdr-app check mods/opencode-usage-detail --print-spec   # what it built
```

Three things that will bite you if you refactor:

- **The dialog is a separate mod on purpose.** An overlay reuses the copy of a
  mod that already lives in the layout and does not hand it new props, so a
  `detail` prop never arrives; the dialog would render the bar inside a big box.
  Opening a mod of its own avoids that entirely.
- **`format.js` is duplicated** in both folders because a mod cannot import from
  outside its own folder (`herdr-app check` fails with
  `module ... resolves outside the application directory`). Copy it to both.
- **`collect.py` keeps its name.** The folder id and the helper names are older
  than the Claude provider; renaming them would break every installed layout for
  no benefit.
- **`svg()` paths need the `mods/` prefix.** A mod resolves SVG paths against the
  app config directory, so `mods/opencode-usage/gauge.svg` draws and
  `opencode-usage/gauge.svg` renders an empty box with no error anywhere. If a
  button looks blank, check the path first.
- **Money is never a bare float.** Group thousands (`$15,000.00`), keep the spent
  amount as the only semibold figure, and put the limit in `muted`: two semibold
  dollar amounts side by side read as one number.

`RECIPE.md` is the full brief behind this mod: look, behaviour, data contract and
the traps above, enough for an agent to rebuild it from an empty folder.

## License

MIT. Not affiliated with opencode, Anthropic or Herdr.
