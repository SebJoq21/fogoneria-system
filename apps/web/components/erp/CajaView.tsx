"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { cajaSummary } from "@/components/erp/summaries/summary-selectors";
import { Modal } from "@/components/ui/Modal";
import { Toolbar } from "@/components/ui/Toolbar";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { CheckoutModal } from "@/components/erp/CheckoutModal";
import {
  accountTotals,
  elapsedLabel,
  expectedCashFor,
  fmtDateTime,
  fmtMoney,
  type TableAccount,
} from "@/lib/domain";
import { canOperateCash } from "@/lib/permissions";

/** Caja: turno con apertura/arqueo, movimientos, cobro de cuentas e historial. */
export function CajaView() {
  const {
    cashMovements,
    setCashMovements,
    openCashShift,
    cashShifts,
    startCashShift,
    closeCashShift,
    accounts,
    notify,
    isGeneral,
    branchOf,
    currentUser,
  } = useModules();
  const canCash = canOperateCash(currentUser?.role);
  const [modalOpen, setModalOpen] = useState(false);
  const [aperturaOpen, setAperturaOpen] = useState(false);
  const [arqueoOpen, setArqueoOpen] = useState(false);
  const [fund, setFund] = useState("200");
  const [counted, setCounted] = useState("");
  const [obs, setObs] = useState("");
  const [checkoutTarget, setCheckoutTarget] = useState<TableAccount | null>(null);
  const [form, setForm] = useState({
    concept: "",
    kind: "Ingreso" as "Ingreso" | "Egreso",
    amount: "",
    method: "Efectivo",
  });

  const summary = useMemo(() => cajaSummary(cashMovements), [cashMovements]);
  const expected = openCashShift
    ? expectedCashFor(openCashShift, cashMovements)
    : 0;
  const countedNum = Number(counted) || 0;
  const difference = Math.round((countedNum - expected) * 100) / 100;
  const porCobrar = accounts.filter((a) => a.status === "abierta");
  const closedShifts = cashShifts.filter((s) => s.status === "cerrado");

  const save = () => {
    if (!canCash || !form.concept.trim() || !Number(form.amount)) return;
    setCashMovements([
      {
        id: Date.now(),
        at: new Date().toISOString(),
        datetime: fmtDateTime(new Date().toISOString()),
        concept: form.concept,
        kind: form.kind,
        amount: Number(form.amount),
        method: form.method,
        shiftId: openCashShift?.id,
      },
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

      {/* Turno de caja */}
      <Card className="mb-4">
        {openCashShift ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-900">
                Turno abierto · {fmtMoney(openCashShift.openingFund)} de fondo
              </p>
              <p className="text-xs text-ink-400">
                Abierto por {openCashShift.openedBy} · {elapsedLabel(openCashShift.openedAt)} ·
                efectivo esperado {fmtMoney(expected)}
              </p>
            </div>
            {canCash && (
              <Button variant="secondary" onClick={() => setArqueoOpen(true)}>
                Cerrar turno (arqueo)
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-900">Caja cerrada</p>
              <p className="text-xs text-ink-400">
                Abre turno con fondo de apertura para registrar cobros y movimientos.
              </p>
            </div>
            {canCash && <Button onClick={() => setAperturaOpen(true)}>Abrir turno</Button>}
          </div>
        )}
      </Card>

      {/* Cuentas por cobrar */}
      <Toolbar
        left={<h3 className="text-sm font-medium text-ink-900">Cuentas por cobrar</h3>}
        right={
          canCash ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(true)}>
                + Registrar movimiento
              </Button>
            </div>
          ) : undefined
        }
      />
      {porCobrar.length === 0 ? (
        <Card className="mb-4">
          <p className="text-sm text-ink-400">Sin cuentas abiertas por cobrar.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
          {porCobrar.map((a) => {
            const totals = accountTotals(a);
            return (
              <Card key={a.id} as="article">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-ink-900">{a.label}</span>
                  <Badge tone="warning" dot>
                    Abierta
                  </Badge>
                </div>
                <p className="text-xs text-ink-400 mb-3">
                  {a.customer || "Consumidor final"} · {a.items.length} plato(s) · mesero{" "}
                  {a.waiter}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-ink-900/[0.06]">
                  <span className="text-sm font-medium text-ink-900 tnum">
                    {fmtMoney(totals.total)}
                  </span>
                  {canCash && (
                    <Button
                      onClick={() => setCheckoutTarget(a)}
                      className="min-h-12 text-sm"
                      disabled={!openCashShift}
                    >
                      Cobrar
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Toolbar
        left={<h3 className="text-sm font-medium text-ink-900">Movimientos del turno</h3>}
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
                {m.kind === "Ingreso" ? "+" : "-"}
                {fmtMoney(m.amount)}
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>

      {/* Historial de turnos */}
      {closedShifts.length > 0 && (
        <>
          <Toolbar
            left={<h3 className="text-sm font-medium text-ink-900">Historial de turnos</h3>}
          />
          <TableCard>
            <THead>
              <tr>
                <TH>Turno</TH>
                <TH>Responsable</TH>
                <TH right>Fondo</TH>
                <TH right>Esperado</TH>
                <TH right>Contado</TH>
                <TH right>Diferencia</TH>
              </tr>
            </THead>
            <tbody>
              {closedShifts.map((s) => (
                <TR key={s.id}>
                  <TD tone="muted" nowrap>
                    <span className="text-nav">
                      {fmtDateTime(s.openedAt)} → {s.closedAt ? fmtDateTime(s.closedAt) : ""}
                    </span>
                  </TD>
                  <TD>{s.closedBy ?? s.openedBy}</TD>
                  <TD right className="tnum">{fmtMoney(s.openingFund)}</TD>
                  <TD right className="tnum">{fmtMoney(s.expectedCash ?? 0)}</TD>
                  <TD right className="tnum">{fmtMoney(s.countedCash ?? 0)}</TD>
                  <TD right className="tnum">
                    <span className={(s.difference ?? 0) === 0 ? "text-ink-600" : "text-persimmon-600"}>
                      {(s.difference ?? 0) >= 0 ? "+" : ""}
                      {fmtMoney(s.difference ?? 0)}
                    </span>
                  </TD>
                </TR>
              ))}
            </tbody>
          </TableCard>
        </>
      )}

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
                  placeholder="Ej. Compra de hielo"
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
                  <option>Plin</option>
                  <option>Tarjeta</option>
                  <option>Transferencia</option>
                </Select>
              </Field>
            </div>
          </div>
        </Modal>
      )}

      {aperturaOpen && (
        <Modal
          onClose={() => setAperturaOpen(false)}
          title="Abrir turno de caja"
          footer={
            <>
              <Button variant="ghost" onClick={() => setAperturaOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!Number(fund) || Number(fund) < 0}
                onClick={() => {
                  startCashShift(Number(fund));
                  notify("Turno abierto", `Fondo de apertura ${fmtMoney(Number(fund))}`);
                  setAperturaOpen(false);
                }}
              >
                Abrir turno
              </Button>
            </>
          }
        >
          <Field label="Fondo de apertura ($)" hint="Efectivo inicial del cajón al abrir.">
            <TextInput
              type="number"
              min="0"
              step="10"
              value={fund}
              onChange={(e) => setFund(e.target.value)}
              className="tnum"
            />
          </Field>
        </Modal>
      )}

      {arqueoOpen && (
        <Modal
          onClose={() => setArqueoOpen(false)}
          title="Arqueo y cierre de turno"
          footer={
            <>
              <Button variant="ghost" onClick={() => setArqueoOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={counted === "" || Number(counted) < 0}
                onClick={() => {
                  closeCashShift(countedNum, obs.trim());
                  notify(
                    "Turno cerrado",
                    difference === 0
                      ? "Arqueo cuadrado sin diferencia."
                      : `Diferencia de ${fmtMoney(difference)} registrada.`,
                  );
                  setArqueoOpen(false);
                  setCounted("");
                  setObs("");
                }}
              >
                Cerrar turno
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-2xl border border-ink-900/10 p-3">
              <div className="flex justify-between text-nav text-ink-600">
                <span>Fondo de apertura</span>
                <span className="tnum">{fmtMoney(openCashShift?.openingFund ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-ink-900">
                <span>Efectivo esperado en caja</span>
                <span className="tnum">{fmtMoney(expected)}</span>
              </div>
            </div>
            <Field label="Efectivo contado ($)" hint="Cuenta física de billetes y monedas.">
              <TextInput
                type="number"
                min="0"
                step="10"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                placeholder="0.00"
                className="tnum"
              />
            </Field>
            {counted !== "" && (
              <p className={`text-sm font-medium ${difference === 0 ? "text-ink-600" : "text-persimmon-600"}`}>
                Diferencia: {difference >= 0 ? "+" : ""}
                {fmtMoney(difference)} {difference === 0 ? "(cuadrado)" : "(sobrante/faltante)"}
              </p>
            )}
            <Field label="Observaciones (opcional)">
              <TextInput
                type="text"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Ej. Diferencia por propinas"
              />
            </Field>
          </div>
        </Modal>
      )}

      {checkoutTarget && (
        <CheckoutModal
          account={checkoutTarget}
          onClose={() => setCheckoutTarget(null)}
        />
      )}
    </div>
  );
}
