// Agent plan usage in Herdr's bottom bar: OpenCode Go and Claude.
//
// One chip group per provider, and one refresh for both. The numbers come from
// the two Python helpers in this folder: collect.py reads the Console login
// opencode keeps in its own database, collect_claude.py reads the Claude Code
// session on this machine. Neither credential is ever touched here: this mod
// only reads the helpers' normalized JSON.
//
// Clicking the numbers switches between the compact view (only the five-hour
// window, the default) and the full one. The gauge icon opens the detail
// dialog; the icon on the right re-reads both providers.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { appHome, exec, nextCommand, openOverlay, setShared, theme } from "herdr";
import {
  SNAPSHOT,
  compact,
  countdown,
  meterPercent,
  moneyPair,
  primaryWindow,
  providers,
  setCompact,
  usageColor,
  windowLabel,
} from "./format.js";

const REFRESH_MS = 120000;
const TICK_MS = 60000;
const HOSTS = ["python", "python3", "py"];
const TITLE = "Usage";
const MOD_DIR = "opencode-usage";
const DETAIL_MOD = "opencode-usage-detail";

// The order here is the order in the bar. Each helper answers with its own JSON
// and may also answer with a readable error; both are normalized below.
const SOURCES = [
  { id: "opencode-go", name: "OpenCode", helper: "collect.py" },
  { id: "claude", name: "Claude", helper: "collect_claude.py" },
];

function failed(source, error, code, action, detail) {
  return {
    id: source.id,
    name: source.name,
    plan: null,
    windows: [],
    money: null,
    period_ends_at: null,
    error: String(error),
    code: code ? String(code) : null,
    action: action ? String(action) : null,
    failure: detail ? String(detail).slice(0, 400) : null,
  };
}

export default class AgentUsage extends View {
  init(_given, cx) {
    this.busy = false;
    this.host = null;
    if (!providers().length) this.refresh(cx);
    cx.timer.every(REFRESH_MS, (cx) => this.refresh(cx));
    // The bar shows reset countdowns, so it redraws once a minute.
    cx.timer.every(TICK_MS, (cx) => cx.notify());
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        if (command === "refresh") this.refresh(cx);
        if (command === "details") this.openDetails();
        if (command === "toggle") this.toggle(cx);
      }
    });
  }

  helper(source) {
    return `${appHome()}/mods/${MOD_DIR}/${source.helper}`;
  }

  async runHelper(source) {
    const hosts = this.host ? [this.host] : HOSTS;
    let lastError = null;
    for (const host of hosts) {
      try {
        const result = await exec(host, [this.helper(source), "--json"]);
        this.host = host;
        return result;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("Python was not found.");
  }

  async readSource(source) {
    let result;
    try {
      result = await this.runHelper(source);
    } catch (error) {
      return failed(
        source,
        "Python could not be started from Herdr.",
        "no_python",
        "Install Python 3 and leave `python` or `python3` on PATH.",
        error?.message ?? error,
      );
    }

    const text = (result.stdout ?? "").trim();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch (_) {
        parsed = null;
      }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return failed(
        source,
        "The usage helper returned no readable JSON.",
        "reader_error",
        "Run the helper by hand to see the error it printed.",
        result.stderr ?? "",
      );
    }
    if (parsed.error) {
      return failed(source, parsed.error, parsed.code, parsed.action, parsed.failure);
    }

    return {
      id: source.id,
      name: source.name,
      plan:
        typeof parsed.product === "string"
          ? parsed.product
          : typeof parsed.plan === "string"
            ? parsed.plan
            : null,
      windows: Array.isArray(parsed.windows) ? parsed.windows : [],
      money: parsed.money && typeof parsed.money === "object" ? parsed.money : null,
      period_ends_at: typeof parsed.period_ends_at === "string" ? parsed.period_ends_at : null,
      updated: typeof parsed.updated === "string" ? parsed.updated : null,
      error: null,
      code: null,
      action: null,
      failure: null,
    };
  }

  toggle(cx) {
    setCompact(!compact());
    cx.notify();
  }

  refresh(cx) {
    if (this.busy) return;
    this.busy = true;
    cx.notify();
    cx.spawn(async (cx) => {
      const records = [];
      for (const source of SOURCES) {
        records.push(await this.readSource(source));
      }
      this.busy = false;
      setShared(SNAPSHOT, { fetched_at: new Date().toISOString(), providers: records });
      cx.notify();
    });
  }

  openDetails() {
    openOverlay({ mod: DETAIL_MOD, kind: "dialog", width: 440, height: 420 });
  }

  render(cx) {
    const t = theme();
    const list = providers();
    const small = compact();

    const chip = (meter) =>
      h_flex()
        .gap(5)
        .items_center()
        .child(div().text_color(t.dim).child(String(meter.label ?? "")))
        .child(
          div().text_color(usageColor(meterPercent(meter), t)).font_semibold().child(windowLabel(meter)),
        )
        .child(div().text_color(t.dim).child(meter.resets_at ? `(${countdown(meter.resets_at)})` : ""));

    const moneyChip = (money) =>
      h_flex()
        .gap(5)
        .items_center()
        .child(div().text_color(t.dim).child(String(money.label ?? "spent")))
        .child(
          h_flex()
            .gap(0)
            .text_color(t.foreground)
            .font_semibold()
            .child(moneyPair(money.used_usd, money.limit_usd)),
        );

    const body = [];
    if (!list.length) {
      body.push(div().text_color(t.foreground).font_semibold().child(TITLE));
      body.push(div().text_color(t.dim).child("···"));
    } else {
      list.forEach((provider, index) => {
        if (index) body.push(div().text_color(t.dim).child("·"));
        body.push(
          div()
            .text_color(t.foreground)
            .font_semibold()
            .child(String(provider.name ?? provider.id ?? "")),
        );
        if (provider.error) {
          const hint = [provider.error, provider.action].filter(Boolean).join("\n");
          body.push(div().text_color(t.blocked).font_semibold().child("!").tooltip(hint));
          return;
        }
        const windows = Array.isArray(provider.windows) ? provider.windows : [];
        const shown = small ? [primaryWindow(provider)].filter(Boolean) : windows;
        if (!shown.length && provider.money) {
          body.push(moneyChip(provider.money));
        }
        shown.forEach((meter, position) => {
          if (position) body.push(div().text_color(t.dim).child("·"));
          body.push(chip(meter));
        });
      });
    }

    const icon = svg(`${MOD_DIR}/refresh.svg`).size(12);
    const gauge = svg(`${MOD_DIR}/gauge.svg`).size(13);
    const mode = small ? "Show all windows" : "Show only the five-hour window";
    return h_flex()
      .id("agent-usage-bar")
      .size_full()
      .px(12)
      .gap(10)
      .items_center()
      .bg(t.chrome)
      .border_t(1)
      .border_color(t.border)
      .text_size(11.5)
      .text_color(t.muted)
      .child(
        h_flex()
          .id("agent-usage-open")
          .px(3)
          .rounded(5)
          .cursor_pointer()
          .hover((s) => s.bg(t.raised))
          .tooltip("Usage detail")
          .on_click(() => this.openDetails())
          .child(gauge),
      )
      .child(
        // The numbers are the toggle: compact shows the five-hour window only.
        h_flex()
          .id("agent-usage-details")
          .gap(10)
          .items_center()
          .px(6)
          .py(2)
          .rounded(5)
          .cursor_pointer()
          .hover((s) => s.bg(t.raised))
          .tooltip(mode)
          .on_click((_event, cx) => this.toggle(cx))
          .children(body),
      )
      .child(
        h_flex()
          .id("agent-usage-refresh")
          .px(6)
          .py(3)
          .rounded(5)
          .cursor_pointer()
          .text_color(this.busy ? t.dim : t.muted)
          .hover((s) => s.bg(t.raised))
          .tooltip("Refresh now")
          .on_click((_event, cx) => this.refresh(cx))
          .child(this.busy ? icon.spin(900) : icon),
      )
      .child(div().flex_1());
  }
}
