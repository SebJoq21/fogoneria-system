"use client";

import { Line, LineChart, ResponsiveContainer, XAxis } from "recharts";
import { initialWhatsappLogs } from "@/lib/erp";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { ChartCard, ColumnLink, LinkColumn, QuickLink } from "./workspace-ui";

const sendsByDay = [
  { name: "Lun", v: 12 }, { name: "Mar", v: 18 }, { name: "Mié", v: 9 },
  { name: "Jue", v: 22 }, { name: "Vie", v: 16 },
];
const tick = { fontSize: 12, fill: "var(--c-mute)" };

/** Workspace WhatsApp: KPIs + gráfico + accesos + columnas. */
export function WhatsappWorkspace() {
  const sent = initialWhatsappLogs.length;
  const failed = initialWhatsappLogs.filter((l) => l.status === "Fallido").length;
  const rate = Math.round(((sent - failed) / Math.max(1, sent)) * 100);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="Enviados hoy" value={String(sent)} hint="confirmaciones + recordatorios" />
        <KpiCard label="Tasa de entrega" value={`${rate}%`} hint="últimos 30 días" />
        <KpiCard label="Fallidos" value={String(failed)} hint="revisar números" />
      </div>

      <ChartCard title="Envíos por día" subtitle="Últimos 5 días">
        <div className="h-full w-full text-primary">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sendsByDay} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} dy={10} />
            <Line type="monotone" dataKey="v" stroke="currentColor" strokeWidth={2} dot={{ r: 3, fill: "currentColor", strokeWidth: 2, stroke: "var(--c-surface)" }} />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </ChartCard>

      <h3 className="text-sm font-medium text-ink-900 mb-3">Acceso rápido</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 mb-10">
        <QuickLink href="/app/modulos/whatsapp/plantillas" label="Plantillas" />
        <QuickLink href="/app/modulos/whatsapp/configuracion" label="Configuración" />
        <QuickLink
          href="/app/modulos/whatsapp/historial"
          label="Historial"
          badge={<Badge tone="neutral">{sent}</Badge>}
        />
        {failed > 0 && (
          <QuickLink
            href="/app/modulos/whatsapp/historial"
            label="Fallidos por reintentar"
            badge={<Badge tone="danger">{failed}</Badge>}
          />
        )}
      </div>

      <h3 className="text-sm font-medium text-ink-900 mb-4">Másteres e informes</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <LinkColumn title="Mensajes">
          <ColumnLink href="/app/modulos/whatsapp/plantillas" label="Plantillas" />
          <ColumnLink href="/app/modulos/whatsapp/configuracion" label="Confirmación de pedido" />
          <ColumnLink href="/app/modulos/whatsapp/configuracion" label="Recordatorio de reserva" />
        </LinkColumn>
        <LinkColumn title="Envíos">
          <ColumnLink href="/app/modulos/whatsapp/historial" label="Historial" />
          <ColumnLink href="/app/modulos/whatsapp/historial" label="Fallidos por reintentar" />
        </LinkColumn>
        <LinkColumn title="Informes">
          <ColumnLink href="/app/modulos/whatsapp/historial" label="Tasa de entrega" />
        </LinkColumn>
      </div>
    </div>
  );
}
