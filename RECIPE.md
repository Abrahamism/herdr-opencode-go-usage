# OpenCode Go usage bar — build brief

A brief another agent can rebuild this mod from an empty folder. Read it whole
before writing code.

## What it is

Two Herdr mods that share one helper:

```
mods/opencode-usage/         main.js, format.js, mod.json, collect.py,
                             gauge.svg, refresh.svg
mods/opencode-usage-detail/  main.js, format.js, mod.json
```

`opencode-usage` is a 28px block for the bottom row of a layout. It shows the
OpenCode Go plan as one chip per window — `5h 1% (1h 5m) · week 7% (1d 4h) ·
month 19% (11d 19h)` — a small gauge icon on the left and a refresh icon right
after the last chip.

`opencode-usage-detail` is the dialog the chips open. `main.js` default-exports a
gpui-kit `View`; there is no other entry point.

## Look

Bar: `h_flex().size_full().px(12).gap(10).items_center().bg(theme().chrome)` with
`border_t(1).border_color(theme().border)`, text 11.5px. Provider name in
`foreground` semibold, window labels and countdowns in `dim`, percentages
semibold in `foreground` and escalating to `working` at 75% and `blocked` at 95%.
The chips group and the refresh icon are separate clickable elements (rounded 5,
`hover` background); nothing pushes the icon away from the numbers — a
`flex_1()` spacer between them is the bug to avoid, and one at the very end of
the row keeps them left-aligned.

Dialog: 420×288, `bg(theme().popover)`, 16px padding, 10px gap. Header with the
title, `plan <name>` in `dim` and an `Esc` close button. One block per window:
label plus percentage on a line, a 388px × 5px meter under it (track
`theme().hover`, fill `theme().accent` / `working` / `blocked`), then
`$used of $limit · resets HH:MM:SS (countdown)` in `dim` 11px. Then the paid
period line, and a footer with `$X left this month`, the read time and a Refresh
button.

## Behaviour

- The bar reads on first show and every 120000 ms; it redraws every 60000 ms
  only to move the countdowns. No animation timers.
- The dialog redraws every 60000 ms while open and never reads by itself: its
  Refresh button sends `opencode-usage.refresh` to the bar, which stays the only
  owner of the helper and of the shared snapshot.
- The last good reading and the last error both go to shared state under
  `opencode-usage.snapshot`, sanitized. Both mods render from it, so opening the
  dialog never triggers a fetch.
- Empty state shows `···`; a failure shows `! OpenCode Go` plus the reason, and
  the dialog adds the action to take.
- `<mod>.refresh` and `<mod>.details` are accepted through `nextCommand()`, so
  `herdr-app do opencode-usage.details` reproduces a click from a shell.

## Data

`collect.py` (Python 3, standard library only) is the only code that reads a
credential or opens a socket:

1. Open `<data dir>/opencode.db` read-only (`file:...?mode=ro`) and take the
   `value` JSON of the newest `credential` row with `integration_id =
   'opencode'`, `active = 1` and `type: "oauth"`. Order by `rowid`, not
   `time_updated`: older schemas lack that column.
2. `GET https://opencode.ai/console/api/go/status` with
   `Authorization: Bearer <access>`, 10s timeout, 1 MiB cap, redirects refused.
3. Map `access.meters.{fiveHour,week,month}`: `limitMicroCents` /
   `usedMicroCents`, 1e8 microcents per USD. Percent = used / limit × 100; a
   reported zero limit means "no limit", never 0%.
4. Print `{provider, product, period_ends_at, windows[{key,label,used_usd,
   limit_usd,percent,resets_at}], updated}` as JSON, or the same text layout in
   the terminal. `--json` is the contract the mod consumes.

Errors are a `{windows: [], error, code, action}` object with exit code 2, so the
mod can publish them unchanged. Never emit the token, the response body or any
account identity.

## Watch out

- An overlay reuses the copy of a mod that already lives in the layout and does
  not deliver new props. That is why the dialog is a separate mod instead of a
  `detail` prop on the bar.
- A mod cannot import from outside its own folder; `format.js` is duplicated.
- `div().bg(raised)` inside a `popover` dialog is nearly invisible. Meter tracks
  need `hover` or `border`.
- `exec` resolves with `{code, stdout, stderr}` even on a nonzero exit; it only
  rejects when the program cannot start. Try `python`, `python3`, `py` in that
  order and remember which one worked (on Windows `python3` may be the Store
  stub).
- Verify with `herdr-app check <folder>` and `--print-spec`; check the dialog by
  opening it with `herdr-app do mod.open opencode-usage-detail` and looking at
  `herdr-app shot`.

## Done when

- Both `check` commands pass, `herdr-app status` reports no errors, and the bar
  renders in a cloned layout with the numbers and countdowns from a real
  account.
- Without a Console login the bar shows `! OpenCode Go` and the dialog names
  `/connect` as the next step, with no traceback.
- The helper runs standalone from a terminal, and its tests pass offline.
