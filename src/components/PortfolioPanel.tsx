import type { PortfolioValue } from "@/lib/calculations";
import { formatMoney, formatNumber } from "@/lib/format";

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
  missingSymbols = [],
}: {
  value: PortfolioValue;
  fxRate: number | null;
  missingSymbols?: string[];
}) {
  const fxAvailable = fxRate != null && fxRate > 0;

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm uppercase tracking-wide text-muted">שווי התיק (נטו)</h2>
        <span className={`text-xs ${fxAvailable ? "text-muted" : "text-neg"}`}>
          {fxAvailable ? `דולר/שקל ${formatNumber(fxRate, 3)} · חי` : "שער דולר/שקל לא זמין"}
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
