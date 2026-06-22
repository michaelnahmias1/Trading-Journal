"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";

// Cumulative gross vs. net equity. The widening gap between the two lines is the
// running cost of friction (commissions + tax).
export function EquityCurveChart({ data }: { data: EquityPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted text-sm">
        No closed trades in this window.
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="#26303f" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#8a97a8", fontSize: 11 }}
            tickFormatter={(d: string) => d.slice(5)}
            stroke="#26303f"
          />
          <YAxis
            tick={{ fill: "#8a97a8", fontSize: 11 }}
            tickFormatter={(v: number) => formatMoney(v)}
            width={70}
            stroke="#26303f"
          />
          <Tooltip
            contentStyle={{
              background: "#1b2433",
              border: "1px solid #26303f",
              borderRadius: 8,
              color: "#e6edf6",
            }}
            formatter={(value: number, name) => [formatMoney(value), name]}
          />
          <Line
            type="monotone"
            dataKey="gross"
            name="Gross"
            stroke="#4493f8"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="net"
            name="Net"
            stroke="#3fb950"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
