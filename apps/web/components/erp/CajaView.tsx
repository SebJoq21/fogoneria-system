"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { cajaSummary } from "@/components/erp/summaries/summary-selectors";
import { Modal } from "@/components/ui/Modal";
import { Toolbar } from "@/components/ui/Toolbar";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { canOperateCash } from "@/lib/permissions";

/** Caja: saldo del turno, movimientos y cierre. */
export function CajaView() {
  const { cashMovements, setCashMovements, notify, isGeneral, branchOf, currentUser } = useModules();
  const canCash = canOperateCash(currentUser?.role);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ concept: "", kind: "Ingreso" as "Ingreso" | "Egreso", amount: "", method: "Efectivo" });

  const summary = useMemo(() => cajaSummary(cashMovements), [cashMovements]);
  const ingresos = summary.ingresos;
  const egresos = summary.egresos;

  const save = () => {
    if (!canCash || !form.concept.trim() || !Number(form.amount)) return;
    setCashMovements([
      { id: Date.now(), datetime: "Ahora mismo", concept: form.concept, kind: form.kind, amount: Number(form.amount), method: form.method },
      ...cashMovements,
    ]);
    setModalOpen(false);
    setForm({ concept: "", kind: "Ingreso", amount: "", method: "Efectivo" });
  };

  return (
    <div>
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Ingresos por método"
        chartSubtitle="Cómo cobra tu franquicia hoy"
        ariaLabel="Resumen de caja"
      >
        <MiniBars data={summary.byMethod} label="Ingresos por método de pago" />
      </ModuleSummary>

      {!canCash && (
        <p className="text-xs text-ink-400 mb-4">Vista de lectura: la caja la opera la sucursal.</p>
      )}

      <Toolbar
        left={<h3 className="text-sm font-medium text-ink-900">Movimientos del turno</h3>}
        right={
          canCash ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => notify("Cierre de caja", `Turno cerrado con saldo $${(ingresos - egresos).toFixed(2)}.`)}>
                Cerrar turno
              </Button>
              <Button onClick={() => setModalOpen(true)}>
                + Registrar movimiento
              </Button>
            </div>
          ) : undefined
        }
      />

      <TableCard>
        <THead>
          <tr>
            <TH>Fecha / Hora</TH>
            {isGeneral && <TH>Sucursal</TH>}
            <TH>Concepto</TH>
            <TH>Tipo</TH>
            <TH>Método</TH>
            <TH right>Monto</TH>
          </tr>
        </THead>
        <tbody>
          {cashMovements.map((m) => (
            <TR key={m.id}>
              <TD tone="muted" nowrap>
                <span className="text-nav">{m.datetime}</span>
              </TD>
              {isGeneral && <TD tone="muted">{branchOf("cash", m.id)?.short}</TD>}
              <TD tone="strong">{m.concept}</TD>
              <TD>
                <Badge tone={m.kind === "Ingreso" ? "success" : "warning"} dot>
                  {m.kind}
                </Badge>
              </TD>
              <TD>{m.method}</TD>
              <TD tone="strong" right nowrap className="tnum">
                {m.kind === "Ingreso" ? "+" : "-"}${m.amount.toFixed(2)}
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title="Registrar movimiento"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!form.concept.trim() || !Number(form.amount)}
                onClick={save}
              >
                Guardar movimiento
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Concepto">
                <TextInput
                  type="text"
                  value={form.concept}
                  onChange={(e) => setForm({ ...form, concept: e.target.value })}
                  placeholder="Ej. Venta mesa 4"
                />
              </Field>
            </div>
            <div>
              <Field label="Tipo">
                <Select
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value as "Ingreso" | "Egreso" })}
                >
                  <option value="Ingreso">Ingreso</option>
                  <option value="Egreso">Egreso</option>
                </Select>
              </Field>
            </div>
            <div>
              <Field label="Monto ($)">
                <TextInput
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  className="tnum"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Método">
                <Select
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                >
                  <option>Efectivo</option>
                  <option>Yape</option>
                  <option>Tarjeta</option>
                  <option>Transferencia</option>
                </Select>
              </Field>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
