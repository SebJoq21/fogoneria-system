"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/fields";
import { useModules } from "@/components/dashboard/ModulesProvider";

/** Maestro de Plantillas WhatsApp: textos por evento con variables. */
export function TemplatesView() {
  const { waTemplates, setWaTemplates, notify } = useModules();
  const [editing, setEditing] = useState<"order" | "reminder" | null>(null);
  const [draft, setDraft] = useState("");

  const rows = [
    { id: "order" as const, event: "Confirmación de pedido", vars: "{nombre_cliente} {numero_pedido}", body: waTemplates.order },
    { id: "reminder" as const, event: "Recordatorio de reserva", vars: "{nombre_cliente} {fecha_reserva}", body: waTemplates.reminder },
  ];

  const openEdit = (id: "order" | "reminder") => {
    setEditing(id);
    setDraft(waTemplates[id]);
  };

  const save = () => {
    if (!editing || !draft.trim()) return;
    setWaTemplates({ ...waTemplates, [editing]: draft });
    notify("Plantilla actualizada", "La configuración la usa al instante.");
    setEditing(null);
  };

  const preview = (body: string) =>
    body
      .replace("{nombre_cliente}", "Camila")
      .replace("{numero_pedido}", "#PD-1042")
      .replace("{fecha_reserva}", "hoy 20:00");

  return (
    <div>
      <p className="text-sm text-ink-400 mb-4">
        {rows.length} plantillas · la configuración y el historial las usan en vivo.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {rows.map((r) => (
          <Card key={r.id} className="flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h3 className="text-sm font-medium text-ink-900">{r.event}</h3>
              <button
                type="button"
                onClick={() => openEdit(r.id)}
                className="text-nav font-medium text-ink-900 hover:underline cursor-pointer"
              >
                Editar
              </button>
            </div>
            <p className="text-xs text-ink-400 mb-3">Variables: {r.vars}</p>
            <div className="rounded-2xl p-3 text-sm text-persimmon-950 whitespace-pre-line" style={{ background: "#ECE5DD" }}>
              {preview(r.body)}
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <Modal
          onClose={() => setEditing(null)}
          title="Editar plantilla"
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button disabled={!draft.trim()} onClick={save}>
                Guardar plantilla
              </Button>
            </>
          }
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
          />
        </Modal>
      )}
    </div>
  );
}
