"use client";

import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
} from "recharts";
import { dataReservas, dataVisitas } from "@/lib/dashboard";
import { Card } from "@/components/ui/Card";

const tick = { fontSize: 12, fill: "var(--c-mute)" };

function MetricCard({
  title,
  value,
  delta,
  children,
}: {
  title: string;
  value: string;
  delta: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col justify-between overflow-hidden">
      <div className="mb-4">
        <h3 className="text-nav font-medium text-ink-600 mb-2">{title}</h3>
        <div className="flex items-end gap-3">
          <span className="text-section font-medium text-ink-900">{value}</span>
          <span className="text-xs font-medium text-ink-600 mb-1">{delta}</span>
        </div>
      </div>
      <div className="h-24 w-full mt-4">{children}</div>
    </Card>
  );
}

export function MetricsCharts() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <MetricCard title="Visitas Totales" value="1,245" delta="+12% este mes">
        <div className="h-full w-full text-primary">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dataVisitas} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorVisitas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.25} />
                <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} dy={10} />
            <Area type="monotone" dataKey="v" stroke="currentColor" strokeWidth={2} fillOpacity={1} fill="url(#colorVisitas)" />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      </MetricCard>

      <MetricCard title="Clics en Reservar" value="112" delta="+5% este mes">
        <div className="h-full w-full text-primary">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dataReservas} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} dy={10} />
            <Line type="monotone" dataKey="v" stroke="currentColor" strokeWidth={2} dot={{ r: 3, fill: "currentColor", strokeWidth: 2, stroke: "var(--c-surface)" }} />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </MetricCard>
    </div>
  );
}
