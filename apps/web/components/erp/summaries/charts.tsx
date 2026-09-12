"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
} from "recharts";

export const chartTick = { fontSize: 12, fill: "var(--c-mute)" };

function ChartFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="h-full w-full text-primary" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

/** Barras verticales compactas (categorías, estados, días). */
export function MiniBars({ data, label, barSize = 24 }: { data: { name: string; v: number }[]; label: string; barSize?: number }) {
  if (data.length === 0) return <p className="text-sm text-ink-400 text-center py-8">Sin datos aún.</p>;
  return (
    <ChartFrame label={label}>
      <BarChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartTick} dy={10} interval={0} />
        <Bar dataKey="v" fill="currentColor" radius={[4, 4, 0, 0]} barSize={barSize} />
      </BarChart>
    </ChartFrame>
  );
}

/** Área suave (flujo en el tiempo). */
export function MiniArea({ data, label, id }: { data: { name: string; v: number }[]; label: string; id: string }) {
  if (data.length === 0) return <p className="text-sm text-ink-400 text-center py-8">Sin datos aún.</p>;
  return (
    <ChartFrame label={label}>
      <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="currentColor" stopOpacity={0.25} />
            <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartTick} dy={10} />
        <Area type="monotone" dataKey="v" stroke="currentColor" strokeWidth={2} fillOpacity={1} fill={`url(#${id})`} />
      </AreaChart>
    </ChartFrame>
  );
}

/** Línea simple (tendencia). */
export function MiniLine({ data, label }: { data: { name: string; v: number }[]; label: string }) {
  if (data.length === 0) return <p className="text-sm text-ink-400 text-center py-8">Sin datos aún.</p>;
  return (
    <ChartFrame label={label}>
      <LineChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartTick} dy={10} />
        <Line type="monotone" dataKey="v" stroke="currentColor" strokeWidth={2} dot={{ r: 3, fill: "currentColor", strokeWidth: 2, stroke: "var(--c-surface)" }} />
      </LineChart>
    </ChartFrame>
  );
}

const DONUT_COLORS = ["var(--c-primary)", "var(--c-med)", "var(--c-mute)", "#e5441d", "#ffb3a0"];

/** Donut de proporciones (estados, segmentos). */
export function MiniDonut({ data, label }: { data: { name: string; v: number }[]; label: string }) {
  const total = data.reduce((s, d) => s + d.v, 0);
  if (total === 0) return <p className="text-sm text-ink-400 text-center py-8">Sin datos aún.</p>;
  return (
    <div className="h-full w-full flex items-center gap-4" role="img" aria-label={label}>
      <div className="h-full flex-1 text-primary">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="v" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} strokeWidth={0}>
              {data.map((_, i) => (
                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="shrink-0 flex flex-col gap-1.5 pr-1">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-xs text-ink-600">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            {d.name} · <strong className="text-ink-900 tnum">{d.v}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
