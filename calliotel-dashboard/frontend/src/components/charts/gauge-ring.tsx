"use client";

import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

export type GaugeRingProps = {
  value: number;
  label: string;
  sublabel?: string;
  detail?: string;
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "h-24 w-24",
  md: "h-32 w-32",
  lg: "h-40 w-40",
} as const;

const VALUE_CLASS = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
} as const;

export function GaugeRing({
  value,
  label,
  sublabel = "out of 100",
  detail,
  max = 100,
  size = "md",
  className = "",
}: GaugeRingProps) {
  const clamped = Math.max(0, Math.min(max, value));
  const data = [{ name: "gauge", value: clamped, fill: "#00E5FF" }];

  return (
    <div className={`glass-panel flex flex-col items-center p-5 text-center ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <div className={`relative mx-auto mt-2 ${SIZE_CLASS[size]}`}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="72%"
            outerRadius="100%"
            barSize={size === "lg" ? 12 : 10}
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              background={{ fill: "rgba(148, 163, 184, 0.15)" }}
              dataKey="value"
              cornerRadius={6}
              max={max}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold tabular-nums text-[#00E5FF] ${VALUE_CLASS[size]}`}>
            {Math.round(clamped)}
          </span>
          {sublabel ? (
            <span className="text-[10px] uppercase tracking-widest text-slate-500">{sublabel}</span>
          ) : null}
        </div>
      </div>
      {detail ? <p className="mt-3 text-xs leading-relaxed text-slate-400">{detail}</p> : null}
    </div>
  );
}