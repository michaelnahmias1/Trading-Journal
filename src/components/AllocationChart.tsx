"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PortfolioValue } from "@/lib/calculations";
import { formatMoney, formatPercent } from "@/lib/format";

// How the portfolio splits between cash and live open positions, as a share of
// total net worth. Everything is expressed in USD so the two native currencies
// fold into one comparable base: ILS is converted only when a live FX rate is
// available, mirroring PortfolioPanel — otherwise the ILS holdings are left in
// their native figure rather than invented at a guessed rate.
function combineUsd(usd: number, ils: number, fxRate: number | null): number {
  return usd + (fxRate != null && fxRate > 0 ? ils / fxRate : 0);
}

const CASH_COLOR = "#4493f8"; // accent
const INVESTED_COLOR = "#3fb950"; // pos

export function AllocationChart({
  value,
  fxRate,
}: {
  value: PortfolioValue;
  fxRate: number | null;
}) {
  // Cash on hand vs. the live market value of open positions (entry cost plus
  // the running unrealized net). Both can go slightly negative — a short's live
  // P&L, or cash drawn below zero — so clamp at zero: a pie can't show a
  // negative slice, and the intent here is "where is the money", not P&L.
  const cash = Math.max(0, combineUsd(value.cashUsd, value.cashIls, fxRate));
  const invested = Math.max(
    0,
    combineUsd(
      value.openCostUsd + value.openLiveNetUsd,
      value.openCostIls + value.openLiveNetIls,
      fxRate
    )
  );

  const total = cash + invested;

  if (total <= 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted text-sm">
        אין נתונים להצגה.
      </div>
    );
  }

  const data = [
    { name: "מושקע", value: invested, color: INVESTED_COLOR },
    { name: "מזומן", value: cash, color: CASH_COLOR },
  ];

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            stroke="none"
            label={({ name, value: v }) =>
              `${name} ${formatPercent((v as number) / total, 0)}`
            }
            labelLine={false}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#1b2433",
              border: "1px solid #26303f",
              borderRadius: 8,
              color: "#e6edf6",
            }}
            formatter={(v: number, name) => [
              `${formatMoney(v)} · ${formatPercent(v / total, 0)}`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
