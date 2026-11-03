// The usage detail dialog, opened from the bar.
//
// Deliberately a mod of its own: an overlay reuses the copy that already lives
// in the layout and does not hand it new props, so the dialog cannot be a mode
// of the bar mod. It reads the same shared snapshot and asks the bar to refresh,
// staying the only owner of the fetches. format.js is duplicated here because a
// mod cannot import from outside its own folder.

import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { closeOverlay, props, run, theme } from "herdr";
import {
  barColor,
  clockTime,
  countdown,
  meterPercent,
  moneyPair,
  providers,
  share,
  snapshot,
  stamp,
  usageColor,
  windowLabel,
} from "./format.js";

const TRACK = 388;
const TICK_MS = 60000;
const TITLE = "Usage";
const BAR_MOD = "opencode-usage";

function subtitle(provider) {
  const plan = provider?.plan;
  if (typeof plan !== "string" || !plan) return "";
  return provider.id === "opencode-go" ? `plan ${plan}` : plan;
}

function detailLine(meter) {
  const parts = [];
  if (typeof meter.used_usd === "number" || typeof meter.limit_usd === "number") {
    parts.push(moneyPair(meter.used_usd, meter.limit_usd));
  }
  if (meter.resets_at) {
    parts.push(`resets ${clockTime(meter.resets_at)} (${countdown(meter.resets_at)})`);
  }
  return parts.join(" · ");
}

function windowRow(meter, t) {
  const percent = meterPercent(meter);
  const width = Math.max(3, Math.round((TRACK * share(percent)) / 100));
  const line = detailLine(meter);
  return v_flex()
    .gap(4)
    .child(
      h_flex()
        .items_center()
        .child(div().text_color(t.foreground).font_semibold().child(String(meter.label ?? "")))
        .child(div().flex_1())
        .child(div().text_color(usageColor(percent, t)).font_semibold().child(windowLabel(meter))),
    )
    .child(
      div()
        .w(TRACK)
        .h(5)
        .rounded(3)
        .bg(t.hover)
        .child(div().h(5).rounded(3).bg(barColor(percent, t)).w(width)),
    )
    .children(line ? [div().text_color(t.dim).text_size(11).child(line)] : []);
}

function moneyRow(money, t) {
  return v_flex()
    .gap(4)
    .child(
      h_flex()
        .items_center()
        .child(
          div().text_color(t.foreground).font_semibold().child(String(money.label ?? "spent")),
        )
        .child(div().flex_1())
        .child(
          div()
            .text_color(t.foreground)
            .font_semibold()
            .child(moneyPair(money.used_usd, money.limit_usd)),
        ),
    );
}

function section(provider, t) {
  const children = [
    h_flex()
      .items_center()
      .gap(8)
      .child(
        div()
          .text_color(t.foreground)
          .text_size(13)
          .font_semibold()
          .child(String(provider.name ?? provider.id ?? "")),
      )
      .child(div().text_color(t.dim).text_size(10.5).child(subtitle(provider))),
  ];

  if (provider.error) {
    children.push(div().text_color(t.blocked).font_semibold().child(String(provider.error)));
    if (provider.action) {
      children.push(div().text_color(t.muted).text_size(11.5).child(String(provider.action)));
    }
    if (provider.failure) {
      children.push(div().text_color(t.dim).text_size(10.5).child(String(provider.failure)));
    }
    return v_flex().gap(6).children(children);
  }

  const windows = Array.isArray(provider.windows) ? provider.windows : [];
  if (windows.length) {
    children.push(v_flex().gap(10).children(windows.map((meter) => windowRow(meter, t))));
  }
  if (provider.money) children.push(moneyRow(provider.money, t));
  if (provider.period_ends_at) {
    children.push(
      div()
        .text_color(t.dim)
        .text_size(11)
        .child(
          `Paid period ends ${stamp(provider.period_ends_at)} · ${countdown(
            provider.period_ends_at,
          )} left`,
        ),
    );
  }
  if (!windows.length && !provider.money && !provider.period_ends_at) {
    children.push(div().text_color(t.dim).child("No reading yet."));
  }
  return v_flex().gap(8).children(children);
}

export default class AgentUsageDetail extends View {
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
    const list = providers();
    const read = clockTime(snapshot()?.fetched_at);
    const body = [];
    list.forEach((provider, index) => {
      if (index) body.push(div().h(1).w(TRACK).bg(t.border));
      body.push(section(provider, t));
    });
    if (!body.length) body.push(div().text_color(t.dim).child("No reading yet."));

    return v_flex()
      .id("agent-usage-detail")
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
          .child(div().flex_1())
          .child(
            div()
              .id("agent-usage-detail-close")
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
          .children(body),
      )
      .child(
        h_flex()
          .items_center()
          .gap(8)
          .child(div().text_color(t.dim).text_size(10.5).child(read ? `read ${read}` : ""))
          .child(div().flex_1())
          .child(
            div()
              .id("agent-usage-detail-refresh")
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
