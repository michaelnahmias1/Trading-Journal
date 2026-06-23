import type { Currency } from "./types";

const SYMBOLS: Record<Currency, string> = { USD: "$", ILS: "₪" };

/** Money with a leading sign when requested (for P&L), tabular-friendly. */
export function formatMoney(
  value: number,
  currency: Currency = "USD",
  opts: { signed?: boolean } = {}
): string {
  const sign = opts.signed && value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${SYMBOLS[currency]}${abs}`;
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Human "last updated" label for a rate, in Hebrew. Same-day shows just the
 * time ("עודכן היום 14:32"); otherwise day/month + time.
 */
export function formatLastUpdated(epochMs: number): string {
  const d = new Date(epochMs);
  const time = d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) {
    return `עודכן היום ${time}`;
  }
  const date = d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
  return `עודכן ${date} ${time}`;
}

/** Tailwind text colour class for a P&L value. */
export function pnlColor(value: number): string {
  if (value > 0) return "text-pos";
  if (value < 0) return "text-neg";
  return "text-muted";
}
