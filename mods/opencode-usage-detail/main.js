// The OpenCode Go detail dialog, opened from the bar.
//
// Deliberately a mod of its own: an overlay reuses the copy that already lives
// in the layout and does not hand it new props, so the dialog cannot be a
// mode of the bar mod. It reads the same shared snapshot and asks the bar to
// refresh, staying the only owner of the fetch. format.js is duplicated here
// because a mod cannot import from outside its own folder.

import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { closeOverlay, props, run, theme } from "herdr";
import {
  barColor,
  clockTime,
  countdown,
  money,
  percentLabel,
  share,
  snapshot,
  stamp,
  usageColor,
} from "./format.js";

const TRACK = 388;
const TICK_MS = 60000;
const TITLE = "OpenCode Go";
const BAR_MOD = "opencode-usage";

export default class OpenCodeUsageDetail extends View {
  init(_given, cx) {
    // Only the countdowns change by the minute; the numbers come from shared.
    cx.timer.every(TICK_MS, (cx) => cx.notify());
  }

  close() {
    const overlay = props()?.overlay;
    if (overlay) closeOverlay(overlay);
    else run("overlay.close");
  }

  render(cx) {
    const t = theme();
    const snap = snapshot();
    const meters = snap && Array.isArray(snap.windows) ? snap.windows : [];
    const rows = meters.map((meter) => {
      const color = usageColor(meter.percent, t);
      const fill = barColor(meter.percent, t);
      const width = Math.max(3, Math.round((TRACK * share(meter.percent)) / 100));
      return v_flex()
        .gap(4)
        .child(
          h_flex()
            .items_center()
            .child(div().text_color(t.foreground).font_semibold().child(String(meter.label ?? "")))
            .child(div().flex_1())
            .child(div().text_color(color).font_semibold().child(percentLabel(meter.percent))),
        )
        .child(
          div()
            .w(TRACK)
            .h(5)
            .rounded(3)
            .bg(t.hover)
            .child(div().h(5).rounded(3).bg(fill).w(width)),
        )
        .child(
          div()
            .text_color(t.dim)
            .text_size(11)
            .child(
              `${money(meter.used_usd)} of ${money(meter.limit_usd)} · resets ${clockTime(
                meter.resets_at,
              )} (${countdown(meter.resets_at)})`,
            ),
        );
    });
    const shown = Boolean(snap && !snap.error && rows.length);
    const month = meters.find((meter) => meter.key === "month");
    const left =
      month && typeof month.limit_usd === "number" && typeof month.used_usd === "number"
        ? `${money(month.limit_usd - month.used_usd)} left this month`
        : "";
    return v_flex()
      .id("opencode-usage-detail")
      .size_full()
      .p(16)
      .gap(10)
      .bg(t.popover)
      .text_size(12.5)
      .text_color(t.muted)
      .child(
        h_flex()
          .items_center()
          .gap(8)
          .child(div().text_color(t.foreground).text_size(14).font_semibold().child(TITLE))
          .child(
            div()
              .text_color(t.dim)
              .text_size(11)
              .child(snap?.product ? `plan ${String(snap.product)}` : ""),
          )
          .child(div().flex_1())
          .child(
            div()
              .id("opencode-usage-detail-close")
              .px(8)
              .py(2)
              .rounded(5)
              .cursor_pointer()
              .text_color(t.dim)
              .hover((s) => s.bg(t.raised))
              .on_click(() => this.close())
              .child("Esc"),
          ),
      )
      // The middle scrolls, so a bigger UI font can never clip the footer.
      .child(
        v_flex()
          .flex_1()
          .min_h(0)
          .gap(10)
          .overflow_y_scrollbar()
          .children(
            shown
              ? [
                  v_flex().gap(10).children(rows),
                  div()
                    .text_color(t.dim)
                    .text_size(11)
                    .child(
                      snap?.period_ends_at
                        ? `Paid period ends ${stamp(snap.period_ends_at)} · ${countdown(
                            snap.period_ends_at,
                          )} left`
                        : "",
                    ),
                ]
              : [
                  div()
                    .text_color(t.blocked)
                    .font_semibold()
                    .child(String(snap?.error ?? "No reading yet.")),
                  ...(snap?.action
                    ? [div().text_color(t.muted).text_size(11.5).child(String(snap.action))]
                    : []),
                  ...(snap?.failure
                    ? [div().text_color(t.dim).text_size(10.5).child(String(snap.failure))]
                    : []),
                ],
          ),
      )
      .child(
        h_flex()
          .items_center()
          .gap(8)
          .child(div().text_color(t.dim).text_size(10.5).child(left))
          .child(
            div()
              .text_color(t.dim)
              .text_size(10.5)
              .child(snap?.fetched_at ? `· read ${clockTime(snap.fetched_at)}` : ""),
          )
          .child(div().flex_1())
          .child(
            div()
              .id("opencode-usage-detail-refresh")
              .px(10)
              .py(3)
              .rounded(6)
              .bg(t.raised)
              .cursor_pointer()
              .text_color(t.foreground)
              .hover((s) => s.opacity(0.88))
              .on_click(() => run(`${BAR_MOD}.refresh`))
              .child("Refresh"),
          ),
      );
  }
}
