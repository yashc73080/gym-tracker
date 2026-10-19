"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayPoint } from "@/lib/stats";

type Metric = { key: keyof DayPoint; label: string; unit: string; color: string };

const ALL: Metric[] = [
  { key: "maxWeight", label: "Top weight", unit: "lb", color: "#ff9f0a" },
  { key: "e1rm", label: "Est. 1RM", unit: "lb", color: "#ffd60a" },
  { key: "totalReps", label: "Reps", unit: "", color: "#30d158" },
  { key: "volume", label: "Volume", unit: "lb", color: "#64d2ff" },
  { key: "sets", label: "Sets", unit: "", color: "#ff453a" },
  { key: "durationS", label: "Duration", unit: "s", color: "#ffd60a" },
];

export function ProgressChart({ points, metrics }: { points: DayPoint[]; metrics: (keyof DayPoint)[] }) {
  const options = ALL.filter((m) => metrics.includes(m.key));
  const [key, setKey] = useState<keyof DayPoint>(options[0]?.key ?? "sets");
  const m = options.find((o) => o.key === key) ?? options[0];
  if (!m || points.length === 0) return <p className="rounded-2xl bg-card p-6 text-muted">Nothing to chart yet.</p>;

  const data = points.map((p) => ({ day: p.day, value: p[m.key] == null ? null : Math.round(Number(p[m.key]) * 10) / 10 }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => setKey(o.key)}
            className={`rounded-full px-3 py-1 text-sm ${o.key === m.key ? "bg-card2 font-semibold" : "text-muted"}`}
            style={o.key === m.key ? { color: o.color } : undefined}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-card p-3 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="#38383a" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "#8e8e93", fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
            <YAxis tick={{ fill: "#8e8e93", fontSize: 11 }} domain={["auto", "auto"]} width={48} />
            <Tooltip
              contentStyle={{ background: "#2c2c2e", border: "1px solid #38383a", borderRadius: 12, color: "#f2f2f7" }}
              formatter={(v) => [`${v} ${m.unit}`.trim(), m.label]}
              labelStyle={{ color: "#8e8e93" }}
            />
            <Line type="monotone" dataKey="value" stroke={m.color} strokeWidth={2.5} dot={{ r: 3, fill: m.color }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
