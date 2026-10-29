"use client";

import { useState } from "react";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatUsd } from "@/lib/format";

export function AllocationChart({ slices }: { slices: { name: string; value: number; fill: string }[] }) {
  if (slices.length === 0) {
    return <p className="text-sm text-muted-foreground">No priced value to chart yet.</p>;
  }
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="transparent">
            {slices.map((slice) => (
              <Cell key={slice.name} fill={slice.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatUsd(Number(value ?? 0))} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PerformanceChart({ points }: { points: { date: string; aum: number; nav: number | null }[] }) {
  const [mode, setMode] = useState<"aum" | "nav">("aum");
  const hasNav = points.some((point) => point.nav !== null);
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">Record an AUM snapshot to start the performance chart.</p>;
  }
  return (
    <div>
      {hasNav ? (
        <div className="mb-3 flex gap-2">
          <button type="button" onClick={() => setMode("aum")} className={`rounded-full px-3 py-1 text-xs ${mode === "aum" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>AUM</button>
          <button type="button" onClick={() => setMode("nav")} className={`rounded-full px-3 py-1 text-xs ${mode === "nav" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>NAV / share</button>
        </div>
      ) : null}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6d655c" }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis
              tick={{ fontSize: 11, fill: "#6d655c" }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(value) => (mode === "aum" ? `$${Math.round(Number(value) / 1_000_000)}m` : `$${Number(value).toFixed(0)}`)}
            />
            <Tooltip formatter={(value) => formatUsd(Number(value ?? 0))} />
            <Line type="monotone" dataKey={mode} name={mode === "aum" ? "AUM" : "NAV"} stroke="#1f4b5a" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
