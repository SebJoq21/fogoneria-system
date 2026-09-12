"use client";

import { useState } from "react";
import { initialWhatsappLogs } from "@/lib/erp";
import { Toggle } from "@/components/ui/Toggle";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Select, Textarea } from "@/components/ui/fields";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";

/** Mockup de teléfono con burbuja WhatsApp y variables interpoladas. */
function PhonePreview({ template }: { template: string }) {
  const preview = template
    .replace("{nombre_cliente}", "Camila")
    .replace("{numero_pedido}", "#PD-1042")
    .replace("{fecha_reserva}", "hoy 20:00");
  return (
    <div className="w-64 shrink-0 mx-auto rounded-[2rem] border border-ink-900/15 bg-surface shadow-sm overflow-hidden">
      <div className="bg-primary text-white text-center text-xs font-medium py-2">
        WhatsApp · Fogonería
      </div>
      <div className="p-3 min-h-48" style={{ background: "#ECE5DD" }}>
        <div className="bg-white rounded-xl rounded-tl-sm p-3 max-w-[90%]">
          <p className="text-nav text-persimmon-950 whitespace-pre-line leading-relaxed">{preview}</p>
          <p className="text-xs text-ink-400 text-right mt-1">13:44 ✓✓</p>
        </div>
      </div>
    </div>
  );
}

export function WhatsappModule({ view = "config" }: { view?: "config" | "historial" }) {
  const { waTemplates, setWaTemplates } = useModules();
  const [orderConfirm, setOrderConfirm] = useState(true);
  const [reminder, setReminder] = useState(true);
  const [reminderTime, setReminderTime] = useState("2h");
  const orderTemplate = waTemplates.order;
  const reminderTemplate = waTemplates.reminder;
  const setOrderTemplate = (v: string) => setWaTemplates({ ...waTemplates, order: v });
  const setReminderTemplate = (v: string) => setWaTemplates({ ...waTemplates, reminder: v });
  const [eventFilter, setEventFilter] = useState<"Todos" | "Pedido" | "Reserva">("Todos");

  const logs =
    eventFilter === "Todos"
      ? initialWhatsappLogs
      : initialWhatsappLogs.filter((l) => l.event === eventFilter);

  return (
    <div>
      {view === "config" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-4">
            <Card>
              <div className="flex items-center justify-between gap-3 mb-1">
                <h3 className="text-sm font-medium text-ink-900">Confirmación de pedido web</h3>
                <Toggle checked={orderConfirm} onChange={setOrderConfirm} label="Confirmación de pedido" />
              </div>
              <p className="text-nav text-ink-400 mb-3">Se envía al instante cuando entra un pedido.</p>
              <Textarea
                value={orderTemplate}
                onChange={(e) => setOrderTemplate(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-ink-400 mt-2">
                Variables: {"{nombre_cliente}"} {"{numero_pedido}"} {"{fecha_reserva}"}
              </p>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3 mb-1">
                <h3 className="text-sm font-medium text-ink-900">Recordatorio de reserva programada</h3>
                <Toggle checked={reminder} onChange={setReminder} label="Recordatorio de reserva" />
              </div>
              <div className="flex items-center gap-2 my-3">
                <span className="text-nav text-ink-600">Enviar recordatorio</span>
                <Select
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-auto"
                >
                  <option value="1h">1h antes</option>
                  <option value="2h">2h antes</option>
                  <option value="4h">4h antes</option>
                  <option value="24h">24h antes</option>
                </Select>
              </div>
              <Textarea
                value={reminderTemplate}
                onChange={(e) => setReminderTemplate(e.target.value)}
                rows={3}
              />
            </Card>
          </div>

          <div>
            <p className="text-xs font-medium uppercase text-ink-400 mb-3 text-center">
              Previsualización en vivo
            </p>
            <PhonePreview template={reminder ? reminderTemplate : orderTemplate} />
          </div>
        </div>
      )}

      {view === "historial" && (
        <TableCard
          header={(["Todos", "Pedido", "Reserva"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setEventFilter(f)}
              className={`px-4 h-10 rounded-full text-nav font-medium cursor-pointer ${
                eventFilter === f
                  ? "bg-primary text-white"
                  : "text-ink-600 border border-ink-900/15"
              }`}
            >
              {f === "Todos" ? "Todos" : f === "Pedido" ? "Pedidos" : "Reservas"}
            </button>
          ))}
        >
          <THead>
            <tr>
              <TH>Fecha / Hora</TH>
              <TH>Teléfono destino</TH>
              <TH>Tipo de evento</TH>
              <TH>Estado</TH>
            </tr>
          </THead>
          <tbody>
            {logs.map((log) => (
              <TR key={log.id}>
                <TD tone="muted" nowrap>
                  <span className="text-nav">{log.datetime}</span>
                </TD>
                <TD tone="strong" nowrap>
                  {log.phone}
                </TD>
                <TD>{log.event}</TD>
                <TD>
                  <Badge tone={log.status === "Entregado" ? "success" : "danger"} dot>
                    {log.status}
                  </Badge>
                </TD>
              </TR>
            ))}
          </tbody>
        </TableCard>
      )}
    </div>
  );
}
