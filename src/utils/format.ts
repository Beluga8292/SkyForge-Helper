import type { Language } from "@/types/app";

const localeOf = (language: Language) => (language === "ru" ? "ru-RU" : "en-US");

export function formatNumber(value: number, language: Language = "ru", fractionDigits = 0): string {
  return new Intl.NumberFormat(localeOf(language), {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

/** Compact game-style formatting: 12.4K / 3.18M / 1.02B. */
export function formatCompact(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}${trim( abs / 1_000_000_000_000, fractionDigits)}T`;
  if (abs >= 1_000_000_000) return `${sign}${trim(abs / 1_000_000_000, fractionDigits)}B`;
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000, fractionDigits)}M`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000, fractionDigits)}K`;
  return `${sign}${trim(abs, abs < 10 ? 2 : 0)}`;
}

function trim(value: number, digits: number): string {
  const rounded = Number(value.toFixed(digits));
  return String(rounded);
}

export function formatCoins(value: number | null | undefined, language: Language = "ru"): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) < 1000) return formatNumber(value, language, value < 10 ? 2 : 0);
  return formatCompact(value, 2);
}

export function formatCoinsExact(value: number | null | undefined, language: Language = "ru"): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatNumber(value, language, 2);
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1000) return formatCompact(value, 2);
  if (value >= 1) return value.toFixed(value < 10 ? 2 : 1);
  return value.toFixed(3);
}

export function formatUuid(uuid: string): string {
  const clean = uuid.replace(/-/g, "");
  if (clean.length !== 32) return uuid;
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

export function formatShortUuid(uuid: string): string {
  const clean = uuid.replace(/-/g, "");
  return clean.length > 12 ? `${clean.slice(0, 8)}…${clean.slice(-4)}` : uuid;
}

export function formatDateTime(ts: number | null | undefined, language: Language = "ru"): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat(localeOf(language), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

export function formatTime(ts: number | null | undefined, language: Language = "ru"): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat(localeOf(language), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ts));
}

export function timeAgo(ts: number | null | undefined, language: Language = "ru", now = Date.now()): string {
  if (!ts) return "—";
  const diff = ts - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(localeOf(language), { numeric: "auto" });
  if (abs < 45_000) return language === "ru" ? "только что" : "just now";
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.round(diff / 86_400_000), "day");
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${Math.round(seconds % 60)}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function formatAgeDays(ms: number | null | undefined): string {
  if (!ms) return "—";
  const days = Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
  return `${days}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
