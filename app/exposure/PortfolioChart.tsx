"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

type Row = { risk_class: string; total_ar: string; total_overdue: string };

const COLORS: Record<string, string> = {
  WATCH:  "#ef4444",
  HIGH:   "#f97316",
  MEDIUM: "#eab308",
  LOW:    "#22c55e",
};

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

export function PortfolioChart({ data }: { data: Row[] }) {
  const chartData = data.map((r) => ({
    name: r.risk_class,
    AR: Math.round(parseFloat(r.total_ar)),
    Overdue: Math.round(parseFloat(r.total_overdue)),
  }));

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barGap={2} barCategoryGap="35%">
          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
          <Tooltip
            formatter={(value, name) => [fmt(Number(value ?? 0)), name === "AR" ? "Total AR" : "Overdue"]}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="AR" radius={[3, 3, 0, 0]} name="AR">
            {chartData.map((d) => (
              <Cell key={d.name} fill={COLORS[d.name] ?? "#94a3b8"} fillOpacity={0.35} />
            ))}
          </Bar>
          <Bar dataKey="Overdue" radius={[3, 3, 0, 0]} name="Overdue">
            {chartData.map((d) => (
              <Cell key={d.name} fill={COLORS[d.name] ?? "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
