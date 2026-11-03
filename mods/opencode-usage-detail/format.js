// Shared formatting for the usage bar and its dialog.
// Both mods read the same snapshot from Herdr's shared state. This file is
// duplicated in both mod folders because a mod cannot import from outside its
// own folder: keep the two copies identical.

import { shared } from "herdr";

export const SNAPSHOT = "opencode-usage.snapshot";
const COMPACT_KEY = "opencode-usage.compact";

export function snapshot() {
  const value = shared(SNAPSHOT);
  return value && typeof value === "object" ? value : null;
}

export function providers() {
  const value = snapshot();
  return value && Array.isArray(value.providers) ? value.providers : [];
}

// Compact is the default: one window per provider, the five-hour one.
export function compact() {
  try {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(COMPACT_KEY) !== "0";
  } catch (_) {
    return true;
  }
}

export function setCompact(value) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(COMPACT_KEY, value ? "1" : "0");
  } catch (_) {
    // A read-only storage keeps the bar usable; the mode just does not persist.
  }
}

// The window worth showing when there is room for only one: the rolling
// five-hour session, then whatever the account does report.
export function primaryWindow(provider) {
  const windows = provider && Array.isArray(provider.windows) ? provider.windows : [];
  const fiveHour = windows.find((meter) => meter.key === "five_hour" || meter.key === "fiveHour");
  if (fiveHour) return fiveHour;
  const withPercent = windows.find((meter) => typeof meter.percent === "number");
  return withPercent ?? windows[0] ?? null;
}

export function percentLabel(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  if (value > 0 && value < 1) return "<1%";
  if (value < 100 && value > 99) return ">99%";
  return `${Math.round(value)}%`;
}

// A window's share of its budget: the reported percentage, or the one implied
// by dollars for accounts that bill by use and report no percentage.
export function meterPercent(meter) {
  if (!meter) return null;
  if (typeof meter.percent === "number" && Number.isFinite(meter.percent)) return meter.percent;
  if (
    typeof meter.used_usd === "number" &&
    Number.isFinite(meter.used_usd) &&
    typeof meter.limit_usd === "number" &&
    Number.isFinite(meter.limit_usd) &&
    meter.limit_usd > 0
  ) {
    return (meter.used_usd / meter.limit_usd) * 100;
  }
  return null;
}

// A window's headline number: a percentage when the account reports one, the
// dollars it spent when the account bills by use instead.
export function windowLabel(meter) {
  if (!meter) return "n/a";
  if (typeof meter.percent === "number" && Number.isFinite(meter.percent)) {
    return percentLabel(meter.percent);
  }
  if (typeof meter.used_usd === "number" && Number.isFinite(meter.used_usd)) {
    return money(meter.used_usd);
  }
  return "n/a";
}

export function usageColor(value, t) {
  if (typeof value !== "number" || !Number.isFinite(value)) return t.foreground;
  if (value >= 95) return t.blocked;
  if (value >= 75) return t.working;
  return t.foreground;
}

// Grouped thousands, two decimals: $15,000.00, never $15000.00.
export function money(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "?";
  const [whole, cents] = Math.abs(value).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${value < 0 ? "-" : ""}$${grouped}.${cents}`;
}

export function moneyPercent(pool) {
  if (!pool) return null;
  if (typeof pool.percent === "number" && Number.isFinite(pool.percent)) return pool.percent;
  const used = pool.used_usd;
  const limit = pool.limit_usd;
  if (
    typeof used === "number" &&
    Number.isFinite(used) &&
    typeof limit === "number" &&
    Number.isFinite(limit) &&
    limit > 0
  ) {
    return (used / limit) * 100;
  }
  return null;
}

// A money pool drawn like a window, so both providers share one row language.
export function moneyMeter(pool) {
  return {
    key: "spend",
    label: String(pool?.label ?? "spend"),
    percent: moneyPercent(pool),
    resets_at: null,
    used_usd: typeof pool?.used_usd === "number" ? pool.used_usd : null,
    limit_usd: typeof pool?.limit_usd === "number" ? pool.limit_usd : null,
  };
}

export function moneyPair(used, limit) {
  const left = money(used);
  const right = typeof limit === "number" && Number.isFinite(limit) ? money(limit) : "no limit";
  return `${left} of ${right}`;
}

export function countdown(iso, now = Date.now()) {
  if (!iso) return "no reset time";
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return "no reset time";
  const minutes = Math.floor((at - now) / 60000);
  if (minutes <= 0) return "reset pending";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes / 60) % 24;
  if (days) return `${days}d ${hours}h`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export function stamp(iso) {
  if (!iso) return "";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : at.toLocaleString();
}

export function clockTime(iso) {
  if (!iso) return "";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : at.toLocaleTimeString();
}

export function share(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function barColor(value, t) {
  if (typeof value !== "number" || !Number.isFinite(value)) return t.accent;
  if (value >= 95) return t.blocked;
  if (value >= 75) return t.working;
  return t.accent;
}
