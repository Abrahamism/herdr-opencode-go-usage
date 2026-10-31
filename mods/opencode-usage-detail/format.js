// Shared formatting for the OpenCode Go bar and its dialog.
// Both mods read the same snapshot from Herdr's shared state.

import { shared } from "herdr";

export const SNAPSHOT = "opencode-usage.snapshot";

export function snapshot() {
  const value = shared(SNAPSHOT);
  return value && typeof value === "object" ? value : null;
}

export function percentLabel(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  if (value > 0 && value < 1) return "<1%";
  if (value < 100 && value > 99) return ">99%";
  return `${Math.round(value)}%`;
}

export function usageColor(value, t) {
  if (typeof value !== "number" || !Number.isFinite(value)) return t.foreground;
  if (value >= 95) return t.blocked;
  if (value >= 75) return t.working;
  return t.foreground;
}

export function money(value) {
  return typeof value === "number" && Number.isFinite(value) ? `$${value.toFixed(2)}` : "?";
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
