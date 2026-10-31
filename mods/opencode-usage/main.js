// OpenCode Go plan usage in Herdr's bottom bar.
//
// One chip per plan window with its reset countdown, and a refresh icon that
// turns while a read is in flight. Clicking the chips opens the detail mod.
// The numbers come from collect.py, the helper in this folder, which reads the
// Console login opencode keeps in its own database. This mod never touches a
// credential: it only reads the helper's normalized JSON.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { appHome, exec, nextCommand, openOverlay, setShared, theme } from "herdr";
import { SNAPSHOT, countdown, percentLabel, snapshot, usageColor } from "./format.js";

const REFRESH_MS = 120000;
const TICK_MS = 60000;
const HOSTS = ["python", "python3", "py"];
const TITLE = "OpenCode Go";
const DETAIL_MOD = "opencode-usage-detail";

export default class OpenCodeUsage extends View {
  init(_given, cx) {
    this.busy = false;
    this.host = null;
    if (!snapshot()) this.refresh(cx);
    cx.timer.every(REFRESH_MS, (cx) => this.refresh(cx));
    // The bar shows reset countdowns, so it redraws once a minute.
    cx.timer.every(TICK_MS, (cx) => cx.notify());
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        if (command === "refresh") this.refresh(cx);
        if (command === "details") this.openDetails();
      }
    });
  }

  helper() {
    return `${appHome()}/mods/opencode-usage/collect.py`;
  }

  async runHelper() {
    const hosts = this.host ? [this.host] : HOSTS;
    let lastError = null;
    for (const host of hosts) {
      try {
        const result = await exec(host, [this.helper(), "--json"]);
        this.host = host;
        return result;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("Python was not found.");
  }

  refresh(cx) {
    if (this.busy) return;
    this.busy = true;
    cx.notify();
    cx.spawn(async (cx) => {
      let record;
      try {
        const result = await this.runHelper();
        let parsed = null;
        const text = (result.stdout ?? "").trim();
        if (text) {
          try {
            parsed = JSON.parse(text);
          } catch (_) {
            parsed = null;
          }
        }
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          record = { ...parsed, fetched_at: new Date().toISOString() };
        } else {
          record = {
            provider: "opencode-go",
            windows: [],
            error: "The usage helper returned no readable JSON.",
            code: "reader_error",
            action: "Run the helper by hand to see the error it printed.",
            failure: (result.stderr ?? "").slice(0, 400),
          };
        }
      } catch (error) {
        record = {
          provider: "opencode-go",
          windows: [],
          error: "Python could not be started from Herdr.",
          code: "no_python",
          action: "Install Python 3 and leave `python` or `python3` on PATH.",
          failure: String(error?.message ?? error).slice(0, 400),
        };
      }
      this.busy = false;
      setShared(SNAPSHOT, record);
      cx.notify();
    });
  }

  openDetails() {
    openOverlay({ mod: DETAIL_MOD, kind: "dialog", width: 420, height: 288 });
  }

  render(cx) {
    const t = theme();
    const snap = snapshot();
    const chip = (meter) => {
      const color = usageColor(meter.percent, t);
      const left = countdown(meter.resets_at);
      return h_flex()
        .gap(5)
        .items_center()
        .child(div().text_color(t.dim).child(String(meter.label ?? "")))
        .child(div().text_color(color).font_semibold().child(percentLabel(meter.percent)))
        .child(div().text_color(t.dim).child(`(${left})`));
    };
    const body = [];
    if (snap && snap.error) {
      body.push(div().text_color(t.blocked).font_semibold().child(`! ${TITLE}`));
      body.push(div().text_color(t.dim).child(String(snap.error)));
    } else if (snap && Array.isArray(snap.windows) && snap.windows.length) {
      body.push(div().text_color(t.foreground).font_semibold().child(TITLE));
      snap.windows.forEach((meter, index) => {
        if (index) body.push(div().text_color(t.dim).child("·"));
        body.push(chip(meter));
      });
    } else {
      body.push(div().text_color(t.foreground).font_semibold().child(TITLE));
      body.push(div().text_color(t.dim).child("···"));
    }
    const icon = svg("mods/opencode-usage/refresh.svg").size(12);
    return h_flex()
      .id("opencode-usage-bar")
      .size_full()
      .px(12)
      .gap(10)
      .items_center()
      .bg(t.chrome)
      .border_t(1)
      .border_color(t.border)
      .text_size(11.5)
      .text_color(t.muted)
      .child(svg("mods/opencode-usage/gauge.svg").size(13))
      .child(
        h_flex()
          .id("opencode-usage-details")
          .gap(10)
          .items_center()
          .px(6)
          .py(2)
          .rounded(5)
          .cursor_pointer()
          .hover((s) => s.bg(t.raised))
          .on_click(() => this.openDetails())
          .children(body),
      )
      .child(
        h_flex()
          .id("opencode-usage-refresh")
          .px(6)
          .py(3)
          .rounded(5)
          .cursor_pointer()
          .text_color(this.busy ? t.dim : t.muted)
          .hover((s) => s.bg(t.raised))
          .on_click((_event, cx) => this.refresh(cx))
          .child(this.busy ? icon.spin(900) : icon),
      )
      .child(div().flex_1());
  }
}
