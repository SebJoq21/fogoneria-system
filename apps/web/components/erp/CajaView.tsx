"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { elapsedLabel, fmtDateTime, fmtMoney, type TableAccount } from "@/lib/domain";
import { canOperateCash } from "@/lib/permissions";
import {
  chargeOrder,
  closeShift,
  createMovement,
  getCurrentShift,
  listMovements,
  listShifts,
  metodoFromUi,
  metodoToUi,
  openShift,
  tipoToUi,
  type ApiCashMethod,
  type ApiCashMovement,
  type ApiShift,
  type ApiShiftState,
} from "@/lib/cash-api";
import { listOrders, type ApiOrder } from "@/lib/orders-api";

/** Fila de movimiento tal como la pinta la tabla. */
type MovimientoVM = {
  id: string;
  datetime: string;
  concept: string;
  kind: "Ingreso" | "Egreso";
  amount: number;
  method: string;
};

/** Turno abierto, con los totales que devuelve el servidor. */
type TurnoVM = {
  id: string;
  fondo: number;
  abiertoPor: string;
  abiertoAt: string;
  esperado: number;
  ingresos: number;
  egresos: number;
  movimientos: number;
};

/** Cuenta u orden pendiente de cobro. */
type CobrableVM = {
  key: string;
  label: string;
  detail: string;
  total: number;
};

type TurnoCerradoVM = {
  id: string;
  rango: string;
  responsable: string;
  fondo: number;
  esperado: number;
  contado: number;
  diferencia: number;
};

/**
 * Caja: turno con apertura/arqueo, movimientos, cobro e historial.
 *
 * Con sesión real todo pasa por la API (AYCDS-34): el turno, los movimientos,
 * el arqueo y el cobro de comandas `ENTREGADO` con `POST /cash/charges`. Sin
 * sesión (demo) se mantiene el estado local de `ModulesProvider`.
 */
export function CajaView() {
  const {
    cashMovements,
    setCashMovements,
    openCashShift,
    cashShifts,
    startCashShift,
    closeCashShift,
    accounts,
    refreshOrders,
    notify,
    isGeneral,
    branchOf,
    currentUser,
  } = useModules();
  const canCash = canOperateCash(currentUser?.role);
  const hasSession = Boolean(currentUser?.empresaId);

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

  // --- estado de la API (solo con sesión) ---
  const [shiftState, setShiftState] = useState<ApiShiftState>(null);
  const [movements, setMovements] = useState<ApiCashMovement[]>([]);
  const [payables, setPayables] = useState<ApiOrder[]>([]);
  const [history, setHistory] = useState<ApiShift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chargeTarget, setChargeTarget] = useState<ApiOrder | null>(null);
  const [chargeForm, setChargeForm] = useState({
    metodo: "EFECTIVO" as ApiCashMethod,
    monto: "",
    propina: "",
  });

  const refreshCash = useCallback(
    async (signal?: AbortSignal) => {
      if (!hasSession) return;
      setLoading(true);
      try {
        const [current, ordenes, turnos] = await Promise.all([
          getCurrentShift(signal),
          listOrders({ estado: "ENTREGADO", limit: 50, signal }),
          listShifts({ limit: 20, signal }),
        ]);
        setShiftState(current);
        setPayables(ordenes.items ?? []);
        setHistory((turnos.items ?? []).filter((turno) => turno.estado === "CERRADO"));

        const turnoId = current?.turno?.id;
        if (turnoId) {
          const lista = await listMovements({ turnoId, signal });
          setMovements(lista.items ?? []);
        } else {
          setMovements([]);
        }
        setError(null);
      } catch (cause) {
        if (signal?.aborted) return;
        setError(
          cause instanceof Error ? cause.message : "No se pudo leer la caja.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [hasSession],
  );

  useEffect(() => {
    if (!hasSession) return;
    const controller = new AbortController();
    // Diferido al siguiente tick: el efecto no debe disparar renders en
    // cascada (regla `react-hooks/set-state-in-effect`).
    const timer = setTimeout(() => {
      void refreshCash(controller.signal);
    }, 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [hasSession, refreshCash]);

  // --- view models (API o demo) ---
  const turno: TurnoVM | null = hasSession
    ? shiftState
      ? {
          id: shiftState.turno.id,
          fondo: Number(shiftState.turno.fondo_apertura),
          abiertoPor: shiftState.turno.usuarios?.nombre ?? "Cajero",
          abiertoAt: shiftState.turno.apertura_at,
          esperado: shiftState.arqueo.esperadoEfectivo,
          ingresos: shiftState.arqueo.ingresos,
          egresos: shiftState.arqueo.egresos,
          movimientos: shiftState.arqueo.movimientos,
        }
      : null
    : openCashShift
      ? {
          id: String(openCashShift.id),
          fondo: openCashShift.openingFund,
          abiertoPor: openCashShift.openedBy,
          abiertoAt: openCashShift.openedAt,
          esperado: Math.round(
            (openCashShift.openingFund +
              cashMovements
                .filter((m) => m.shiftId === openCashShift.id)
                .reduce(
                  (sum, m) => sum + (m.kind === "Ingreso" ? m.amount : -m.amount),
                  0,
                )) *
              100,
          ) / 100,
          ingresos: cashMovements
            .filter((m) => m.shiftId === openCashShift.id && m.kind === "Ingreso")
            .reduce((sum, m) => sum + m.amount, 0),
          egresos: cashMovements
            .filter((m) => m.shiftId === openCashShift.id && m.kind === "Egreso")
            .reduce((sum, m) => sum + m.amount, 0),
          movimientos: cashMovements.filter((m) => m.shiftId === openCashShift.id).length,
        }
      : null;

  const filas: MovimientoVM[] = hasSession
    ? movements.map((movimiento) => ({
        id: movimiento.id,
        datetime: fmtDateTime(movimiento.created_at),
        concept: movimiento.concepto,
        kind: tipoToUi(movimiento.tipo),
        amount: Number(movimiento.monto),
        method: metodoToUi(movimiento.metodo),
      }))
    : cashMovements.map((movimiento) => ({
        id: String(movimiento.id),
        datetime: movimiento.datetime,
        concept: movimiento.concept,
        kind: movimiento.kind === "Ingreso" ? "Ingreso" : "Egreso",
        amount: movimiento.amount,
        method: movimiento.method,
      }));

  const cobrables: CobrableVM[] = hasSession
    ? payables.map((orden) => ({
        key: orden.id,
        label: orden.mesas?.numero ? `Mesa ${orden.mesas.numero}` : orden.origen,
        detail: `${orden.numero_orden} · ${orden.usuarios?.nombre ?? "Mesero"}`,
        total: Number(orden.total),
      }))
    : accounts
        .filter((account) => account.status === "abierta")
        .map((account) => ({
          key: account.id,
          label: account.label,
          detail: `${account.customer || "Consumidor final"} · ${account.items.length} plato(s) · mesero ${account.waiter}`,
          total: Number(
            account.items
              .reduce(
                (sum, item) =>
                  sum +
                  item.unitPrice * item.qty +
                  item.modifiers.reduce((extra, modifier) => extra + modifier.extra, 0),
                0,
              )
              .toFixed(2),
          ),
        }));

  const cerrados: TurnoCerradoVM[] = hasSession
    ? history.map((shift) => ({
        id: shift.id,
        rango: `${fmtDateTime(shift.apertura_at)} → ${shift.cierre_at ? fmtDateTime(shift.cierre_at) : ""}`,
        responsable: shift.usuarios?.nombre ?? "Cajero",
        fondo: Number(shift.fondo_apertura),
        // El esperado en efectivo no se guarda aparte: `diferencia = contado - esperado`.
        esperado:
          Number(shift.efectivo_contado ?? 0) - Number(shift.diferencia ?? 0),
        contado: Number(shift.efectivo_contado ?? 0),
        diferencia: Number(shift.diferencia ?? 0),
      }))
    : cashShifts
        .filter((shift) => shift.status === "cerrado")
        .map((shift) => ({
          id: String(shift.id),
          rango: `${fmtDateTime(shift.openedAt)} → ${shift.closedAt ? fmtDateTime(shift.closedAt) : ""}`,
          responsable: shift.closedBy ?? shift.openedBy,
          fondo: shift.openingFund,
          esperado: shift.expectedCash ?? 0,
          contado: shift.countedCash ?? 0,
          diferencia: shift.difference ?? 0,
        }));

  const summary = useMemo(() => cajaSummary(cashMovements), [cashMovements]);
  const expected = turno?.esperado ?? 0;
  const countedNum = Number(counted) || 0;
  const difference = Math.round((countedNum - expected) * 100) / 100;

  // --- acciones ---
  const abrirTurno = async () => {
    if (!Number(fund) && Number(fund) !== 0) return;
    setBusy(true);
    try {
      if (hasSession) {
        await getCurrentShift().then(async (current) => {
          if (current) throw new Error("Ya hay un turno abierto");
          await openShift(Number(fund));
        });
        await refreshCash();
      } else {
        startCashShift(Number(fund));
      }
      notify("Turno abierto", `Fondo de apertura ${fmtMoney(Number(fund))}`);
      setAperturaOpen(false);
    } catch (cause) {
      notify(
        "No se pudo abrir la caja",
        cause instanceof Error ? cause.message : "Revisa la conexión.",
      );
    } finally {
      setBusy(false);
    }
  };

  const guardarMovimiento = async () => {
    if (!form.concept.trim() || !Number(form.amount) || !turno) return;
    setBusy(true);
    try {
      if (hasSession) {
        await createMovement({
          tipo: form.kind === "Ingreso" ? "INGRESO" : "EGRESO",
          concepto: form.concept.trim(),
          monto: Number(form.amount),
          metodo: metodoFromUi(form.method),
        });
        await refreshCash();
      } else {
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
      }
      setModalOpen(false);
      setForm({ concept: "", kind: "Ingreso", amount: "", method: "Efectivo" });
    } catch (cause) {
      notify(
        "No se pudo registrar",
        cause instanceof Error ? cause.message : "Revisa la conexión.",
      );
    } finally {
      setBusy(false);
    }
  };

  const cerrarTurno = async () => {
    if (!turno || counted === "") return;
    setBusy(true);
    try {
      if (hasSession) {
        const { arqueo } = await closeShift(turno.id, {
          efectivoContado: countedNum,
          ...(obs.trim() ? { observaciones: obs.trim() } : {}),
        });
        await refreshCash();
        notify(
          "Turno cerrado",
          arqueo.diferencia === 0
            ? "Arqueo cuadrado sin diferencia."
            : `Diferencia de ${fmtMoney(arqueo.diferencia ?? 0)} registrada.`,
        );
      } else {
        closeCashShift(countedNum, obs.trim());
        notify(
          "Turno cerrado",
          difference === 0
            ? "Arqueo cuadrado sin diferencia."
            : `Diferencia de ${fmtMoney(difference)} registrada.`,
        );
      }
      setArqueoOpen(false);
      setCounted("");
      setObs("");
    } catch (cause) {
      notify(
        "No se pudo cerrar",
        cause instanceof Error ? cause.message : "Revisa la conexión.",
      );
    } finally {
      setBusy(false);
    }
  };

  const cobrar = async () => {
    if (!chargeTarget) return;
    setBusy(true);
    try {
      const result = await chargeOrder({
        ordenId: chargeTarget.id,
        metodo: chargeForm.metodo,
        ...(chargeForm.monto ? { monto: Number(chargeForm.monto) } : {}),
        ...(chargeForm.propina ? { propina: Number(chargeForm.propina) } : {}),
      });
      await Promise.all([refreshCash(), refreshOrders()]);
      notify(
        result.pagada ? "Comanda cobrada" : "Pago parcial registrado",
        result.pagada
          ? `${result.numeroOrden} · ${fmtMoney(result.cobrado)}${result.propina ? ` + propina ${fmtMoney(result.propina)}` : ""}`
          : `${result.numeroOrden} · falta ${fmtMoney(result.pendiente)}`,
      );
      setChargeTarget(null);
      setChargeForm({ metodo: "EFECTIVO", monto: "", propina: "" });
    } catch (cause) {
      notify(
        "No se pudo cobrar",
        cause instanceof Error ? cause.message : "Revisa la conexión.",
      );
    } finally {
      setBusy(false);
    }
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

      {(loading || error) && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          {loading && <p className="text-sm text-ink-400">Leyendo caja…</p>}
          {error && (
            <>
              <p className="text-sm text-persimmon-600" role="alert">
                {error}
              </p>
              <Button variant="secondary" onClick={() => void refreshCash()}>
                Reintentar
              </Button>
            </>
          )}
        </div>
      )}

      {/* Turno de caja */}
      <Card className="mb-4">
        {turno ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-900">
                Turno abierto · {fmtMoney(turno.fondo)} de fondo
              </p>
              <p className="text-xs text-ink-400">
                Abierto por {turno.abiertoPor} · {elapsedLabel(turno.abiertoAt)} ·
                efectivo esperado {fmtMoney(turno.esperado)} · {turno.movimientos} movimiento(s)
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
            {canCash && (
              <Button onClick={() => setAperturaOpen(true)} disabled={busy}>
                Abrir turno
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Por cobrar */}
      <Toolbar
        left={<h3 className="text-sm font-medium text-ink-900">Cuentas por cobrar</h3>}
        right={
          canCash ? (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setModalOpen(true)}
                disabled={!turno}
              >
                + Registrar movimiento
              </Button>
            </div>
          ) : undefined
        }
      />
      {cobrables.length === 0 ? (
        <Card className="mb-4">
          <p className="text-sm text-ink-400">Sin cuentas abiertas por cobrar.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
          {cobrables.map((cobrable) => {
            const orden = hasSession
              ? payables.find((item) => item.id === cobrable.key)
              : null;
            return (
              <Card key={cobrable.key} as="article">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-ink-900">{cobrable.label}</span>
                  <Badge tone="warning" dot>
                    Abierta
                  </Badge>
                </div>
                <p className="text-xs text-ink-400 mb-3">{cobrable.detail}</p>
                <div className="flex items-center justify-between pt-2 border-t border-ink-900/[0.06]">
                  <span className="text-sm font-medium text-ink-900 tnum">
                    {fmtMoney(cobrable.total)}
                  </span>
                  {canCash && (
                    <Button
                      onClick={() =>
                        orden
                          ? setChargeTarget(orden)
                          : setCheckoutTarget(
                              accounts.find((account) => account.id === cobrable.key) ?? null,
                            )
                      }
                      className="min-h-12 text-sm"
                      disabled={!turno}
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
          {filas.map((fila) => (
            <TR key={fila.id}>
              <TD tone="muted" nowrap>
                <span className="text-nav">{fila.datetime}</span>
              </TD>
              {isGeneral && <TD tone="muted">{branchOf("cash", fila.id)?.short}</TD>}
              <TD tone="strong">{fila.concept}</TD>
              <TD>
                <Badge tone={fila.kind === "Ingreso" ? "success" : "warning"} dot>
                  {fila.kind}
                </Badge>
              </TD>
              <TD>{fila.method}</TD>
              <TD tone="strong" right nowrap className="tnum">
                {fila.kind === "Ingreso" ? "+" : "-"}
                {fmtMoney(fila.amount)}
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>

      {/* Historial de turnos */}
      {cerrados.length > 0 && (
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
              {cerrados.map((turnoCerrado) => (
                <TR key={turnoCerrado.id}>
                  <TD tone="muted" nowrap>
                    <span className="text-nav">{turnoCerrado.rango}</span>
                  </TD>
                  <TD>{turnoCerrado.responsable}</TD>
                  <TD right className="tnum">{fmtMoney(turnoCerrado.fondo)}</TD>
                  <TD right className="tnum">{fmtMoney(turnoCerrado.esperado)}</TD>
                  <TD right className="tnum">{fmtMoney(turnoCerrado.contado)}</TD>
                  <TD right className="tnum">
                    <span
                      className={
                        turnoCerrado.diferencia === 0 ? "text-ink-600" : "text-persimmon-600"
                      }
                    >
                      {turnoCerrado.diferencia >= 0 ? "+" : ""}
                      {fmtMoney(turnoCerrado.diferencia)}
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
                disabled={busy || !form.concept.trim() || !Number(form.amount)}
                onClick={() => void guardarMovimiento()}
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
                  onChange={(e) =>
                    setForm({ ...form, kind: e.target.value as "Ingreso" | "Egreso" })
                  }
                >
                  <option value="Ingreso">Ingreso</option>
                  <option value="Egreso">Egreso</option>
                </Select>
              </Field>
            </div>
            <div>
              <Field label="Monto (S/)">
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
                disabled={busy || !Number(fund) || Number(fund) < 0}
                onClick={() => void abrirTurno()}
              >
                Abrir turno
              </Button>
            </>
          }
        >
          <Field label="Fondo de apertura (S/)" hint="Efectivo inicial del cajón al abrir.">
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

      {arqueoOpen && turno && (
        <Modal
          onClose={() => setArqueoOpen(false)}
          title="Arqueo y cierre de turno"
          footer={
            <>
              <Button variant="ghost" onClick={() => setArqueoOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={busy || counted === "" || Number(counted) < 0}
                onClick={() => void cerrarTurno()}
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
                <span className="tnum">{fmtMoney(turno.fondo)}</span>
              </div>
              <div className="flex justify-between text-sm text-ink-600">
                <span>Ingresos / egresos</span>
                <span className="tnum">
                  +{fmtMoney(turno.ingresos)} / -{fmtMoney(turno.egresos)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-medium text-ink-900">
                <span>Efectivo esperado en caja</span>
                <span className="tnum">{fmtMoney(turno.esperado)}</span>
              </div>
            </div>
            <Field label="Efectivo contado (S/)" hint="Cuenta física de billetes y monedas.">
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
              <p
                className={`text-sm font-medium ${
                  difference === 0 ? "text-ink-600" : "text-persimmon-600"
                }`}
              >
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

      {chargeTarget && (
        <Modal
          onClose={() => setChargeTarget(null)}
          title={`Cobrar ${chargeTarget.numero_orden}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setChargeTarget(null)}>
                Cancelar
              </Button>
              <Button disabled={busy} onClick={() => void cobrar()}>
                Cobrar
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-2xl border border-ink-900/10 p-3 flex justify-between">
              <span className="text-nav text-ink-600">Total de la comanda</span>
              <span className="text-sm font-medium text-ink-900 tnum">
                {fmtMoney(Number(chargeTarget.total))}
              </span>
            </div>
            <Field label="Método">
              <Select
                value={chargeForm.metodo}
                onChange={(e) =>
                  setChargeForm({ ...chargeForm, metodo: e.target.value as ApiCashMethod })
                }
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="YAPE">Yape</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </Select>
            </Field>
            <Field
              label="Monto a cobrar (opcional)"
              hint="Déjalo vacío para cobrar todo el saldo pendiente."
            >
              <TextInput
                type="number"
                min="0"
                step="0.1"
                value={chargeForm.monto}
                onChange={(e) => setChargeForm({ ...chargeForm, monto: e.target.value })}
                placeholder={String(Number(chargeTarget.total))}
                className="tnum"
              />
            </Field>
            <Field label="Propina (opcional)">
              <TextInput
                type="number"
                min="0"
                step="1"
                value={chargeForm.propina}
                onChange={(e) => setChargeForm({ ...chargeForm, propina: e.target.value })}
                placeholder="0.00"
                className="tnum"
              />
            </Field>
          </div>
        </Modal>
      )}

      {checkoutTarget && (
        <CheckoutModal account={checkoutTarget} onClose={() => setCheckoutTarget(null)} />
      )}
    </div>
  );
}
