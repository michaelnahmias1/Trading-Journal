"use client";

import type { Timeframe } from "@/lib/types";

const OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "month", label: "חודש" },
  { value: "quarter", label: "רבעון" },
  { value: "year", label: "שנה" },
  { value: "all", label: "הכול" },
];

// The single source of truth for time. Lifted into whichever screen owns it;
// no component keeps its own timeframe.
export function TimeframeToggle({
  value,
  onChange,
}: {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}) {
  return (
    <div className="inline-flex bg-surface border border-border rounded-lg p-1 text-sm">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-md transition-colors ${
            value === o.value ? "bg-surface-2 text-text" : "text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
