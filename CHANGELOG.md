# Changelog

All notable changes to this mod are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

The two mod folders (`opencode-usage`, `opencode-usage-detail`) ship together and
share one version.

## [Unreleased]

### Changed

- Each provider is drawn as its **mark instead of its name**, monochrome so it
  follows the theme. The name and the plan stay one hover away in the tooltip,
  and screen readers get the name through `accessibility_label`.
- New `opencode.svg` and `claude.svg` in the bar folder; a provider without a
  mark still falls back to its name.

### Fixed

- The catalogue card kept showing the old title and preview: it reads the README's
  first heading, its first paragraphs and its **first image**, and image caches key
  on the URL. The screenshots are renamed with the version (`card-0.3.0.png`,
  `preview-0.3.0.png`, `dialog-0.3.0.png`) so every cache sees a new URL, and the
  card is a 1200×630 composition instead of a 1916×56 strip that rendered tiny.

### Notes

- Brand marks come from [Simple Icons](https://simpleicons.org) (CC0 1.0).
  OpenCode, Claude and Anthropic are trademarks of their respective owners; this
  mod is not affiliated with them and does not imply endorsement.

## [0.2.0] — 2026-11-03

Claude joins the bar, and the bar learns to show less.

### Added

- **Claude as a second provider**, read from the Claude Code session on this
  machine (`~/.claude/.credentials.json`) through the same usage endpoint the
  `/usage` view uses. Percentages when the account has plan windows; dollars when
  it bills by use.
- **Compact and full views.** The bar opens compact (the five-hour window of each
  provider) and a click on the numbers expands it to every window. The choice is
  remembered across restarts.
- **`opencode-usage.toggle`** command, the keyboard equivalent of that click.
- **A money pool row** for usage-billed accounts: the monthly credit pool is read
  in minor units (`amount_minor` + `exponent`) and drawn like a window, with
  grouped thousands.
- **Visible controls**: the detail and refresh buttons now sit to the left of the
  numbers, have their own background and border, and carry tooltips.

### Changed

- The bar is no longer OpenCode-only: one shared snapshot feeds both providers, so
  there is one read cycle and one dialog for both.
- **Clicking the numbers now switches the view** instead of opening the dialog.
  The dialog opens from the gauge button (or `opencode-usage.details`).
- The detail dialog grew to 440×460 and shows one section per provider.
- Money formatting: `$15,000.00` instead of `$15000.00`, with only the spent
  amount in semibold.

### Fixed

- A usage-billed account reported its monthly limit in cents as if it were
  dollars: `$150.00` showed as `$15,000.00`. The `spend` block now wins over
  `extra_usage`, and both are scaled by the exponent the payload declares.
- The detail and refresh buttons rendered as empty boxes with no error anywhere,
  because the SVG path lost its `mods/` prefix in the rewrite.
- A wide empty band between the buttons and the numbers, left by a spacer that
  pushed the buttons to the right edge of the block.
- The last line of the Claude section fell below the scroll fold at the old
  420px height.
- A Claude credential file with an empty token is reported as "not signed in"
  with a next step, instead of as a transient read error.

## [0.1.0] — 2026-10-31

First release.

### Added

- OpenCode Go plan usage in Herdr's bottom bar: the rolling five-hour window, the
  UTC week and the paid month, each with the percentage used and a countdown to
  its reset.
- A detail dialog with the dollars behind each percentage, the exact local reset
  times and the paid period end.
- `collect.py`, a dependency-free reader of the Console login opencode keeps in
  its own database, with actionable errors for a missing login, an expired
  session, no network and an unexpected response.
- `opencode-usage.refresh` and `opencode-usage.details` commands.
