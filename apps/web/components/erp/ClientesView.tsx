"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { Modal } from "@/components/ui/Modal";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { Toolbar } from "@/components/ui/Toolbar";
import { useModules } from "@/components/dashboard/ModulesProvider";
import type { Customer } from "@/lib/erp";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniDonut } from "@/components/erp/summaries/charts";
import { clientesSummary } from "@/components/erp/summaries/summary-selectors";
import {
  adjustPoints,
  createCustomer,
  getCustomer,
  lastVisitLabel,
  listCustomers,
  segmentLabel,
  type ApiCustomer,
  type ApiCustomerDetail,
  type ApiPointsType,
  type ApiSegmento,
} from "@/lib/crm-api";

const segmentTone = { VIP: "dark", Frecuente: "success", Nuevo: "neutral" } as const;

function toCustomer(api: ApiCustomer): Customer {
  return {
    id: api.visitas + api.puntos, // el demo usa id numérico; aquí solo es clave de lista
    name: api.nombre,
    phone: api.telefono,
    points: api.puntos,
    visits: api.visitas,
    segment: segmentLabel(api.segmento),
    lastVisit: lastVisitLabel(api.ultima_visita),
  };
}

/** Maestro de Clientes: comensales identificados con puntos y segmento (AYCDS-40). */
export function ClientesView() {
  const { hasSession, customers, setCustomers, notify, activeBranchId } = useModules();
  const [apiRows, setApiRows] = useState<ApiCustomer[]>([]);
  const [query, setQuery] = useState("");
  const [segmento, setSegmento] = useState<ApiSegmento | "">("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApiCustomerDetail | null>(null);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [pointsForm, setPointsForm] = useState({ tipo: "GANANCIA" as ApiPointsType, puntos: "", motivo: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!hasSession) return;
      setApiError(null);
      try {
        const lista = await listCustomers({
          ...(query.trim() ? { q: query.trim() } : {}),
          ...(segmento ? { segmento } : {}),
          limit: 100,
          signal,
        });
        setApiRows(lista.items);
      } catch (error) {
        if (signal?.aborted) return;
        setApiError(error instanceof Error ? error.message : "No se pudo cargar el CRM.");
      }
    },
    [hasSession, query, segmento],
  );

  useEffect(() => {
    if (!hasSession) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void refresh(controller.signal);
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [hasSession, refresh]);

  const rows: Customer[] = hasSession ? apiRows.map(toCustomer) : customers;
  const summary = useMemo(() => clientesSummary(rows), [rows]);

  const openDetail = async (cliente: ApiCustomer) => {
    try {
      setDetail(await getCustomer(cliente.id));
    } catch (error) {
      notify("No se pudo abrir la ficha", error instanceof Error ? error.message : "Reintenta.");
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    if (hasSession) {
      try {
        await createCustomer({ nombre: form.name.trim(), telefono: form.phone.trim() });
        notify("Cliente registrado", `"${form.name}" ya acumula puntos.`);
        setModalOpen(false);
        setForm({ name: "", phone: "" });
        await refresh();
      } catch (error) {
        notify("No se pudo registrar", error instanceof Error ? error.message : "Revisa el teléfono.");
      }
      return;
    }

    const id = Math.max(0, ...customers.map((c) => c.id)) + 1;
    setCustomers([
      { id, name: form.name, phone: form.phone, points: 0, visits: 0, segment: "Nuevo", lastVisit: "Hoy" },
      ...customers,
    ]);
    notify("Cliente registrado", `"${form.name}" ya acumula puntos.`);
    setModalOpen(false);
    setForm({ name: "", phone: "" });
  };

  const applyPoints = async () => {
    if (!detail || !Number(pointsForm.puntos)) return;
    try {
      await adjustPoints(detail.id, {
        tipo: pointsForm.tipo,
        puntos: Number(pointsForm.puntos),
        // ADMIN_GLOBAL no lleva sucursal en el token: la manda la UI (AYCDS-31).
        ...(activeBranchId ? { sucursalId: activeBranchId } : {}),
        ...(pointsForm.motivo.trim() ? { motivo: pointsForm.motivo.trim() } : {}),
      });
      notify(
        "Puntos actualizados",
        `${pointsForm.tipo === "GANANCIA" ? "+" : "-"}${pointsForm.puntos} en ${detail.nombre}.`,
      );
      setPointsOpen(false);
      setPointsForm({ tipo: "GANANCIA", puntos: "", motivo: "" });
      setDetail(await getCustomer(detail.id));
      await refresh();
    } catch (error) {
      notify("No se pudo ajustar", error instanceof Error ? error.message : "Reintenta.");
    }
  };

  return (
    <div>
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Clientes por segmento"
        chartSubtitle="Quiénes sostienen tu franquicia"
        ariaLabel="Resumen de clientes"
      >
        <MiniDonut data={summary.donut} label="Clientes por segmento" />
      </ModuleSummary>

      <Toolbar
        left={
          <div className="flex flex-wrap items-center gap-2">
            <TextInput
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o teléfono"
              aria-label="Buscar cliente"
            />
            <Select
              value={segmento}
              onChange={(e) => setSegmento(e.target.value as ApiSegmento | "")}
              aria-label="Filtrar por segmento"
            >
              <option value="">Todos los segmentos</option>
              <option value="NUEVO">Nuevos</option>
              <option value="FRECUENTE">Frecuentes</option>
              <option value="VIP">VIP</option>
            </Select>
            <p className="text-sm text-ink-400">{rows.length} clientes</p>
            {apiError && <span className="text-sm text-danger">{apiError}</span>}
          </div>
        }
        right={<Button onClick={() => setModalOpen(true)}>+ Nuevo cliente</Button>}
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
          {rows.map((c, indice) => (
            <TR key={`${c.phone}-${indice}`}>
              <TD tone="strong">
                {hasSession ? (
                  <button
                    type="button"
                    className="cursor-pointer hover:text-primary text-left"
                    onClick={() => void openDetail(apiRows[indice])}
                  >
                    {c.name}
                  </button>
                ) : (
                  c.name
                )}
              </TD>
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
              <Button disabled={!form.name.trim() || !form.phone.trim()} onClick={() => void save()}>
                Registrar cliente
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre">
              <TextInput
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Rosa Pérez"
              />
            </Field>
            <Field label="Teléfono" hint="Es el identificador de fidelidad: único por empresa.">
              <TextInput
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+51 999 888 777"
              />
            </Field>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal
          onClose={() => setDetail(null)}
          title={`Ficha · ${detail.nombre}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDetail(null)}>
                Cerrar
              </Button>
              <Button onClick={() => setPointsOpen(true)}>Ajustar puntos</Button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-ink-900/10 p-3">
              <p className="text-xs text-ink-400">Puntos</p>
              <p className="text-display font-medium tnum">{detail.puntos.toLocaleString("es-PE")}</p>
            </div>
            <div className="rounded-2xl border border-ink-900/10 p-3">
              <p className="text-xs text-ink-400">Visitas</p>
              <p className="text-display font-medium tnum">{detail.visitas}</p>
            </div>
            <div className="rounded-2xl border border-ink-900/10 p-3">
              <p className="text-xs text-ink-400">Segmento</p>
              <p className="font-medium">{segmentLabel(detail.segmento)}</p>
            </div>
            <div className="rounded-2xl border border-ink-900/10 p-3">
              <p className="text-xs text-ink-400">Última visita</p>
              <p className="font-medium">{lastVisitLabel(detail.ultima_visita)}</p>
            </div>
          </div>
          <p className="mt-4 mb-2 text-sm font-medium text-ink-900">Últimos movimientos de puntos</p>
          {detail.movimientos_puntos.length === 0 ? (
            <p className="text-sm text-ink-400">Sin movimientos todavía.</p>
          ) : (
            <ul className="divide-y divide-ink-900/10">
              {detail.movimientos_puntos.map((movimiento) => (
                <li key={movimiento.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink-600">
                    {movimiento.motivo ?? movimiento.tipo}
                    {movimiento.orden_id ? " · comanda" : ""}
                  </span>
                  <span className="tnum font-medium">
                    {movimiento.tipo === "GANANCIA" ? "+" : "-"}
                    {movimiento.puntos}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {detail && pointsOpen && (
        <Modal
          onClose={() => setPointsOpen(false)}
          title={`Ajustar puntos · ${detail.nombre}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPointsOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!Number(pointsForm.puntos)} onClick={() => void applyPoints()}>
                Aplicar
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tipo">
              <Select
                value={pointsForm.tipo}
                onChange={(e) => setPointsForm({ ...pointsForm, tipo: e.target.value as ApiPointsType })}
              >
                <option value="GANANCIA">Cortesía (suma)</option>
                <option value="CANJE">Canje (resta)</option>
                <option value="CADUCIDAD">Caducidad (resta)</option>
              </Select>
            </Field>
            <Field label="Puntos">
              <TextInput
                type="number"
                min={1}
                value={pointsForm.puntos}
                onChange={(e) => setPointsForm({ ...pointsForm, puntos: e.target.value })}
                className="tnum"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Motivo" hint="Queda en auditoría y en el historial del cliente.">
                <TextInput
                  type="text"
                  value={pointsForm.motivo}
                  onChange={(e) => setPointsForm({ ...pointsForm, motivo: e.target.value })}
                  placeholder="Ej. Cortesía por demora"
                />
              </Field>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
