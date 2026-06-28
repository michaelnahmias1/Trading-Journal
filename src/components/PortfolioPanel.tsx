import type { PortfolioValue } from "@/lib/calculations";
import { formatLastUpdated, formatMoney, formatNumber, pnlColor } from "@/lib/format";

// One breakdown line — a label and its native USD / ILS amounts side by side, so
// the cost basis that used to hide inside "initial capital" is now visible.
function BreakdownRow({
  label,
  usd,
  ils,
  signed = false,
  pnl = false,
}: {
  label: string;
  usd: number;
  ils: number;
  signed?: boolean;
  pnl?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="flex gap-4 tnum">
        <span className={pnl ? pnlColor(usd) : ""}>{formatMoney(usd, "USD", { signed })}</span>
        <span className={pnl ? pnlColor(ils) : ""}>{formatMoney(ils, "ILS", { signed })}</span>
      </span>
    </div>
  );
}

// Portfolio value — state, not statistics. Always NET (after a 25% tax
// provision, applied to unrealized gains too). Shown in BOTH currencies; the two
// figures breathe with FX in opposite directions.
//
// When the live FX rate is unavailable we do NOT invent a conversion — the ILS
// figure is shown as "—" with an explicit notice. Likewise, open positions whose
// live price is missing are called out instead of being silently dropped.
export function PortfolioPanel({
  value,
  fxRate,
  fxAsOf = null,
  missingSymbols = [],
}: {
  value: PortfolioValue;
  fxRate: number | null;
  fxAsOf?: number | null;
  missingSymbols?: string[];
}) {
  const fxAvailable = fxRate != null && fxRate > 0;
  const fxUpdated = fxAsOf != null ? formatLastUpdated(fxAsOf) : null;

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm uppercase tracking-wide text-muted">שווי התיק (נטו)</h2>
        <span className={`text-xs ${fxAvailable ? "text-muted" : "text-neg"}`}>
          {fxAvailable
            ? `דולר/שקל ${formatNumber(fxRate, 3)}${fxUpdated ? ` · ${fxUpdated}` : ""}`
            : "שער דולר/שקל לא זמין"}
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <div>
          <div className="text-3xl font-semibold tnum">
            {formatMoney(fxAvailable ? value.usd : value.nativeUsd, "USD")}
          </div>
          <div className="text-muted text-xs mt-0.5">בדולרים</div>
        </div>
        <div>
          <div className="text-3xl font-semibold tnum">
            {fxAvailable ? formatMoney(value.ils, "ILS") : "—"}
          </div>
          <div className="text-muted text-xs mt-0.5">בשקלים</div>
        </div>
      </div>

      {/* How the value is built: cash + the open positions at their ENTRY cost +
          the live unrealized net. The first two columns are USD, the second ILS
          (native, before any FX conversion). */}
      <div className="mt-4 border-t border-border pt-3 space-y-1.5 text-sm">
        <BreakdownRow label="מזומן" usd={value.cashUsd} ils={value.cashIls} />
        <BreakdownRow
          label="שווי פוזיציות פתוחות (עלות כניסה)"
          usd={value.openCostUsd}
          ils={value.openCostIls}
        />
        <BreakdownRow
          label="רווח/הפסד לא ממומש (נטו)"
          usd={value.openLiveNetUsd}
          ils={value.openLiveNetIls}
          signed
          pnl
        />
      </div>

      {!fxAvailable && (
        <p className="text-neg text-xs mt-3">
          לא ניתן לטעון שער דולר/שקל חי כעת. הסכום בשקלים אינו מוצג — לא מוצג ערך משוער.
        </p>
      )}
      {missingSymbols.length > 0 && (
        <p className="text-neg text-xs mt-2">
          חסרים מחירים חיים עבור: {missingSymbols.join(", ")}. הפוזיציות האלה לא נכללו בשווי.
        </p>
      )}

      <p className="text-muted text-xs mt-3">
        כמה יישאר אם תממש הכול עכשיו. הפער בין שתי התצוגות נובע משער המטבע, לא מהמסחר.
      </p>
    </div>
  );
}
