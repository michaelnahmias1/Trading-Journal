import { formatMoney } from "@/lib/format";

// The rolling tax balance, on its own line — separate from everything else.
// POSITIVE = you owe the state; NEGATIVE = accrued credit consumed by future
// gains. Conceptually resets Jan 1 (the "Year" view shows that balance).
export function TaxLine({ balance }: { balance: number }) {
  const owe = balance > 0;
  const credit = balance < 0;
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
      <div>
        <div className="text-muted text-xs uppercase tracking-wide">Tax balance</div>
        <div className="text-xs text-muted mt-0.5">
          {owe ? "Liability — owed to the state" : credit ? "Accrued credit (tax shield)" : "Flat"}
        </div>
      </div>
      <div
        className={`text-2xl font-semibold tnum ${
          owe ? "text-neg" : credit ? "text-pos" : "text-muted"
        }`}
      >
        {formatMoney(balance, "USD", { signed: true })}
      </div>
    </div>
  );
}
