# OpenCode Go usage bar

A thin bar at the bottom of the window that shows how much of the OpenCode Go
plan is spent: the rolling 5-hour window, the UTC week and the paid month, each
with the percentage used and a countdown to its reset. A refresh icon sits next
to the numbers, and clicking the numbers opens a small dialog with the dollars
behind each percentage. The numbers are the plan's own meters, not estimates.

![OpenCode Go usage bar](preview.png)

## What you see

**In the bar** (28px tall, full width of the block it is given, left to right):
a 13px gauge icon in the muted color, then `OpenCode Go` at 11.5px semibold in
`foreground`, then one chip per window separated by a `dim` middle dot:
`5h 1% (1h 5m) · week 7% (1d 4h) · month 19% (11d 19h)`. Inside a chip the
window label is `dim`, the percentage is semibold `foreground`, and the
countdown is `dim` in parentheses. A percentage at or above 75 turns `working`,
at or above 95 `blocked`, and between 0 and 1 it reads `<1%` (over 99 reads
`>99%`). The chips group and the refresh icon right after it highlight on hover.
Background `chrome`, a 1px top border in `border`, and the refresh icon is a
12px circular arrow that spins while a read is in flight.

Measured on the default dark theme: `foreground` `#eeeeef`, `dim` `#696a6d`,
`muted` `#98999b`, `raised` `#2c2e31`, `popover` `#25272b`, `accent` `#96b2d7`.
Every color is taken from `theme()` by name, so a light theme follows.

![The detail dialog](dialog.png)

**In the dialog** (420×320, `popover` background, 16px padding, 10px gaps): a
header with `OpenCode Go` at 14px semibold, `plan go` in `dim` 11px and an `Esc`
button on the right. Then one block per window: the label and its percentage on
one line, a 388×5px meter under it (track `hover`, fill `accent` / `working` /
`blocked`, rounded 3px), and under that, in `dim` 11px,
`$0.14 of $12.00 · resets 02:42:52 PM (1h 5m)`. Then
`Paid period ends 11/12/2026, 09:15:07 AM · 11d 19h left`. A footer holds
`$48.42 left this month` and `· read 01:29:49 PM` in `dim` 10.5px and a
`Refresh` button on the right.

When there is no reading yet the bar shows `OpenCode Go ···`. A failure replaces
the chips with `! OpenCode Go` in `blocked` plus the reason, and the dialog adds
the next step the person should take.

## How it behaves

The bar reads as soon as it first shows and every 120000ms afterwards; it
redraws every 60000ms only to move the countdowns. Nothing animates on a timer:
the only motion is the refresh icon spinning (native, 900ms per turn) while a
read is running.

Clicking the chips opens the dialog as a plain dialog overlay, 420×320, with a scrolling middle so a bigger UI font cannot clip the footer. Clicking
the refresh icon, or `Refresh` in the dialog, starts a read in the bar; the
dialog never reads by itself, it only re-renders when the shared snapshot
changes, and its footer time updates with it. `Esc` or the header button closes
it. Agent states (working, blocked, done, idle) do not affect any of it: only
consumption sets a color.

`<mod>.refresh` and `<mod>.details` are delivered to the bar's `nextCommand()`,
so `herdr-app do opencode-usage.refresh` and `... .details` do what the click
does. There are no global keys and no `keys.json` snippet is needed.

Failures keep their reason: no Console login, an expired session (HTTP 401), a
refused read (403), rate limiting (429), no network, a database that is not
there, and a response with no meters each produce a specific sentence and a next
step, never a blank bar.

## Built from

Two mods, because of the first trap under **Watch out**:

```
mods/opencode-usage/        main.js, format.js, mod.json, collect.py,
                            gauge.svg, refresh.svg
mods/opencode-usage-detail/ main.js, format.js, mod.json
```

`mods/opencode-usage/mod.json` is `{"place": "none", "size": 28, "overlay":
{"width": 420, "height": 320}}`; the detail mod's is the same with `width`/`height`
only. Both default-export a gpui-kit `View`; there is no other entry point.

The bar uses `theme()`, `appHome()`, `exec()`, `setShared()`, `shared()` through
`format.js`, `openOverlay()` and `nextCommand()`. It publishes the whole reading
to shared key `opencode-usage.snapshot`. The dialog uses `theme()`, `props()`,
`closeOverlay()` and `run("opencode-usage.refresh")`. Both `format.js` copies hold
the same helpers: `snapshot()`, `percentLabel()`, `usageColor()`, `barColor()`,
`money()`, `countdown()`, `stamp()`, `clockTime()`, `share()`.

The only program either mod runs is the helper, with `["<appHome>/mods/opencode-usage/collect.py", "--json"]`,
trying `python`, then `python3`, then `py`, and remembering which one worked.
The helper is Python 3, standard library only: it opens `<data dir>/opencode.db`
read-only (`file:...?mode=ro`), takes the `value` JSON of the newest `credential`
row with `integration_id = 'opencode'`, `active = 1` and `type: "oauth"`, then
calls `GET https://opencode.ai/console/api/go/status` with that access token as
a Bearer header (10s timeout, 1 MiB cap, redirects refused). `access.meters`
carries `{fiveHour, week, month}` with `limitMicroCents` and `usedMicroCents`,
1e8 microcents per USD; percent is used/limit×100, and a reported zero limit
means "no limit", never 0%. It prints
`{provider, product, period_ends_at, windows[{key,label,used_usd,limit_usd,percent,resets_at}], updated}`
and exits 0, or `{windows: [], error, code, action}` with exit 2.

In a layout it is a block in a 28px row, next to `workspace-status`:

```json
{ "id": "footer", "type": "row", "size": { "px": 28 }, "children": [
  { "id": "usage", "type": "block", "size": { "weight": 1.35 }, "min": 340,
    "content": { "mod": "opencode-usage" } },
  { "id": "status", "type": "block", "size": { "weight": 1 },
    "content": { "mod": "workspace-status" } } ] }
```

The art is two small SVG files: `gauge.svg` (a needle under an arc) and
`refresh.svg` (a circular arrow), both `stroke="currentColor"` so `svg()` tints
them with the text color.

## Watch out

- **The dialog must be its own mod.** An overlay reuses the copy of a mod that
  already lives in the layout and does not hand it new props, so a `detail` prop
  never arrives and the dialog renders the bar inside a big empty box. Opening a
  second mod by name is what works.
- **A mod cannot import from outside its own folder.** `herdr-app check` fails
  with `module ... resolves outside the application directory`. `format.js` is
  duplicated on purpose; copy it to both folders when you change it.
- `div().bg(raised)` inside a `popover` dialog is nearly invisible; meter tracks
  need `hover` or `border`. And `foreground` as a 1%-wide fill reads as a stray
  line: use `accent` for the fill and keep `working` / `blocked` for thresholds.
- `exec()` resolves with `{code, stdout, stderr}` even on a nonzero exit and only
  rejects when the program cannot start, so the exit-2 error JSON is read and
  published like any other reading. On Windows `python3` may be the Store stub
  that resolves to a different interpreter; the helper is tried in order for
  that reason.
- The Console device login lasts about 30 days. When it expires the bar asks for
  `/connect` again; the helper deliberately does not touch the refresh token,
  because rotating it breaks the owner's login.
- The status endpoint is internal and undocumented: it can change without
  notice, which is why a response without meters is reported as `no_quota`
  instead of showing zeros.
- Only the bar copy fetches. Adding a timer to the dialog would double the reads
  and the two copies would race on the shared snapshot.
- One account: whichever Console login opencode has stored. The numbers describe
  the plan, so any agent using that API key shows up in them.

## Done when

- `herdr-app check mods/opencode-usage` and `herdr-app check mods/opencode-usage-detail`
  both print `check passed`, and `herdr-app check ... --print-spec` shows the three
  window labels with their percentages and a 388-wide meter in each dialog row.
- With a connected Console login the bar shows three chips with real percentages
  and countdowns that move once a minute, and the dialog shows dollars, exact
  reset times, the paid period end and a `left this month` figure that equals
  limit minus used for the month window.
- `python mods/opencode-usage/collect.py` prints the same three windows from a
  terminal and exits 0; the same command with `--db /nonexistent` exits 2 with a
  message and a next step, no traceback.
- Without a Console login the bar reads `! OpenCode Go` and the dialog names
  `/connect` as the next step.
- `python -m unittest discover -s tests -v` passes: 10 offline tests over
  synthetic data, including one asserting a credential cannot reach the rendered
  output.
