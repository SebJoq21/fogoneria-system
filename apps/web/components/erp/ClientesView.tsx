"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { Modal } from "@/components/ui/Modal";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { Toolbar } from "@/components/ui/Toolbar";
import { useModules } from "@/components/dashboard/ModulesProvider";
import type { Customer } from "@/lib/erp";

const segmentTone = { VIP: "dark", Frecuente: "success", Nuevo: "neutral" } as const;

/** Maestro de Clientes: comensales identificados con puntos y segmento. */
export function ClientesView() {
  const { customers, setCustomers, notify } = useModules();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", segment: "Nuevo" as Customer["segment"] });

  const save = () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    const id = Math.max(0, ...customers.map((c) => c.id)) + 1;
    setCustomers([
      { id, name: form.name, phone: form.phone, points: 0, visits: 0, segment: form.segment, lastVisit: "Hoy" },
      ...customers,
    ]);
    notify("Cliente registrado", `"${form.name}" ya acumula puntos.`);
    setModalOpen(false);
    setForm({ name: "", phone: "", segment: "Nuevo" });
  };

  return (
    <div>
      <Toolbar
        left={<p className="text-sm text-ink-400">{customers.length} clientes registrados.</p>}
        right={
          <Button onClick={() => setModalOpen(true)}>
            + Nuevo cliente
          </Button>
        }
      />

      <TableCard>
        <THead>
          <tr>
            <TH>Cliente</TH>
            <TH>Teléfono</TH>
            <TH>Puntos</TH>
            <TH>Visitas</TH>
            <TH>Segmento</TH>
            <TH>Última visita</TH>
          </tr>
        </THead>
        <tbody>
          {customers.map((c) => (
            <TR key={c.id}>
              <TD tone="strong">{c.name}</TD>
              <TD nowrap>{c.phone}</TD>
              <TD tone="strong" className="tnum">
                {c.points.toLocaleString("es-PE")}
              </TD>
              <TD className="tnum">{c.visits}</TD>
              <TD>
                <Badge tone={segmentTone[c.segment]} dot={c.segment !== "VIP"}>
                  {c.segment}
                </Badge>
              </TD>
              <TD tone="muted" nowrap>
                <span className="text-nav">{c.lastVisit}</span>
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title="Nuevo cliente"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!form.name.trim() || !form.phone.trim()}
                onClick={save}
              >
                Registrar cliente
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Field label="Nombre">
                <TextInput
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej. Rosa Pérez"
                />
              </Field>
            </div>
            <div>
              <Field label="Teléfono / WhatsApp">
                <TextInput
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+51 999 888 777"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Segmento inicial">
                <Select
                  value={form.segment}
                  onChange={(e) => setForm({ ...form, segment: e.target.value as Customer["segment"] })}
                >
                  <option value="Nuevo">Nuevo</option>
                  <option value="Frecuente">Frecuente</option>
                  <option value="VIP">VIP</option>
                </Select>
              </Field>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
