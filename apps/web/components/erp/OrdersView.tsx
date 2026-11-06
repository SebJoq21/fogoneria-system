"use client";

import { useMemo, useState } from "react";
import { type Order } from "@/lib/erp";
import { elapsedLabel, fmtMoney } from "@/lib/domain";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { ordenesSummary } from "@/components/erp/summaries/summary-selectors";
import { canConfirmRecepcion, canMarkListo, type OrdersMode } from "@/lib/permissions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useNow } from "@/components/useNow";
import { useOrdersRealtime } from "@/components/erp/useOrdersRealtime";
import { useOrdersBoard } from "@/components/erp/useOrdersBoard";
import {
  KDS_COLUMNS,
  minutosDeSla,
  slaTone,
  type KdsOrder,
} from "@/lib/order-mapping";
import type { RealtimeStatus } from "@/lib/realtime";

/** Estado del canal en vivo (AYCDS-14). */
function liveState(status: RealtimeStatus): { label: string; tone: "success" | "warning" | "neutral" } {
  if (status === "connected") return { label: "En vivo", tone: "success" };
  if (status === "connecting" || status === "reconnecting") {
    return { label: "Reconectando…", tone: "warning" };
  }
  return { label: "Sin canal en vivo", tone: "neutral" };
}

/** Comanda mínima para disparar una transición desde el tablero. */
function actionOrderOf(item: KdsOrder): Order {
  return {
    id: item.id,
    apiId: item.apiId,
    tableId: null,
    customer: item.customer,
    items: [],
    amount: item.amount,
    time: "",
    elapsed: elapsedLabel(item.slaBaseAt),
    createdAt: item.createdAt,
    status: item.status,
    channel: item.channel,
    ...(item.waiter ? { waiter: item.waiter } : {}),
    ...(item.mesa ? { mesaApiId: item.mesa.id } : {}),
  };
}

export function OrdersView({ mode = "ordenes" }: { mode?: OrdersMode } = {}) {
  const {
    orders,
    advanceOrder,
    ordersLoading,
    ordersError,
    refreshOrders,
    activeBranch,
    isGeneral,
    branchOf,
    currentUser,
    notify,
  } = useModules();
  useNow(30000);

  const hasSession = Boolean(currentUser?.empresaId);
  const { board, loading: boardLoading, error: boardError, refresh: refreshBoard } =
    useOrdersBoard(hasSession);

  const canConfirm = canConfirmRecepcion(currentUser?.role, mode);
  const canListo = canMarkListo(currentUser?.role, mode);
  const [pendingConfirm, setPendingConfirm] = useState<Order | null>(null);
  const [pendingListo, setPendingListo] = useState<Order | null>(null);

  // Un solo socket: cada evento relee el tablero (SLA y columnas) y el estado
  // de las comandas que usan los resúmenes y el panel del mesero.
  const { status: liveStatus, lastEvent } = useOrdersRealtime(hasSession, () => {
    void refreshBoard();
    void refreshOrders();
  });
  const live = liveState(liveStatus);

  const summary = useMemo(
    () => (mode === "ordenes" ? ordenesSummary(orders) : null),
    [orders, mode],
  );

  /** Columnas del tablero real; sin sesión, agrupación del estado local. */
  const columns = useMemo(() => {
    if (board) return board.columns;
    return KDS_COLUMNS.map(({ status, label }) => ({
      status,
      label,
      orders: [] as KdsOrder[],
    }));
  }, [board]);

  const localByFolio = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );

  const counts = useMemo(() => {
    if (board) {
      const porEstado = new Map(columns.map((columna) => [columna.status, columna.orders.length]));
      return {
        pendiente: porEstado.get("pendiente") ?? 0,
        cocina: porEstado.get("cocina") ?? 0,
        abiertas: board.metricas.abiertas,
        fueraDeSla: board.metricas.fueraDeSla,
      };
    }
    return {
      pendiente: orders.filter((order) => order.status === "pendiente").length,
      cocina: orders.filter((order) => order.status === "cocina").length,
      abiertas: orders.filter((order) => order.status !== "entregado" && order.status !== "anulado").length,
      fueraDeSla: 0,
    };
  }, [board, columns, orders]);

  const confirm = (order: Order) => {
    // Cocina confirma la recepción: pendiente → en cocina.
    if (order.status !== "pendiente" || !canConfirm) return;
    setPendingConfirm(null);
    void advanceOrder(order, "cocina").then((ok) => {
      if (ok) {
        notify("Pedido en cocina", `${order.id} · ${order.customer}`);
        void refreshBoard();
      } else {
        notify("No se pudo confirmar", "Revisa el estado de la comanda.");
      }
    });
  };

  const advance = (order: Order) => {
    // En cocina se marca listo (el entregado lo hace el mesero).
    if (order.status !== "cocina" || !canListo) return;
    setPendingListo(null);
    void advanceOrder(order, "listo").then((ok) => {
      if (ok) {
        notify(
          "Orden lista",
          `${order.id} · ${order.customer}${order.waiter ? ` · avisar a ${order.waiter}` : ""}`,
        );
        void refreshBoard();
      } else {
        notify("No se pudo marcar listo", "Revisa el estado de la comanda.");
      }
    });
  };

  const loading = hasSession ? boardLoading : ordersLoading;
  const error = hasSession ? boardError : ordersError;
  const retry = () => (hasSession ? void refreshBoard() : void refreshOrders());

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-section font-medium text-ink-900 flex items-center gap-2">
            {mode === "cocina" ? "Cocina" : "Órdenes"}
          </h2>
          {mode === "cocina" ? (
            <p className="text-sm text-ink-400 mt-1">
              {counts.pendiente} por confirmar · {counts.cocina} en cocina
              {board && counts.fueraDeSla > 0 ? (
                <span className="text-persimmon-600"> · {counts.fueraDeSla} fuera de SLA</span>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-ink-400 mt-1">
              Comandas de <strong className="text-ink-900">{activeBranch.name}</strong>
              {board ? ` · ${counts.abiertas} abiertas` : ""}.
            </p>
          )}
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <Badge tone={live.tone} dot>
            {live.label}
          </Badge>
          {lastEvent && (
            <p className="text-xs text-ink-400">
              {lastEvent.title} · {lastEvent.detail}
            </p>
          )}
        </div>
      </div>

      {(loading || error) && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          {loading && <p className="text-sm text-ink-400">Cargando comandas…</p>}
          {error && (
            <>
              <p className="text-sm text-persimmon-600" role="alert">
                {error}
              </p>
              <Button variant="secondary" onClick={retry}>
                Reintentar
              </Button>
            </>
          )}
        </div>
      )}

      {board?.truncado && (
        <p className="text-xs text-ink-400 mb-4" role="status">
          Se muestran las {board.columns.reduce((total, columna) => total + columna.orders.length, 0)} comandas
          más antiguas de la ventana.
        </p>
      )}

      {mode === "ordenes" && summary && (
        <ModuleSummary
          kpis={summary.kpis}
          chartTitle="Comandas por estado"
          chartSubtitle="Resumen en vivo de la operación"
          ariaLabel="Resumen de órdenes"
        >
          <MiniBars data={summary.bars} label="Comandas por estado: por confirmar, cocina, listo y entregado" />
        </ModuleSummary>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {columns.map((col) => (
          <div key={col.status} className="bg-primary/[0.03] rounded-2xl p-3">
            <div className="flex items-center justify-between px-1 mb-3">
              <h3 className="text-nav font-medium text-ink-600">{col.label}</h3>
              <span className="text-xs font-medium text-ink-400 bg-surface rounded-full px-2 py-0.5 border border-ink-900/10">
                {col.orders.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {col.orders.length === 0 && (
                <p className="text-xs text-ink-400 text-center py-6">Sin comandas aquí.</p>
              )}
              {col.orders.map((item) => {
                const local = localByFolio.get(item.id);
                const minutos = minutosDeSla(item.slaBaseAt);
                const tone = slaTone(minutos, item.alertaSla, board?.slaMinutos ?? 20);
                const lines = local?.items ?? [];
                const actionOrder = local ?? actionOrderOf(item);

                return (
                  <Card key={item.apiId} as="article">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-ink-900">{item.id}</span>
                      <span className="flex items-center gap-1.5">
                        <Badge tone={tone}>{elapsedLabel(item.slaBaseAt)}</Badge>
                        {mode === "ordenes" && (
                          <>
                            {isGeneral && branchOf("orders", item.id) && (
                              <Badge tone="neutral">{branchOf("orders", item.id)?.short}</Badge>
                            )}
                            <Badge tone="neutral">{item.channel}</Badge>
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-nav text-ink-600 mb-2">
                      {mode === "cocina"
                        ? item.customer
                        : `${item.customer}${local ? ` · ${local.time}` : ""}`}
                    </p>
                    {lines.length > 0 ? (
                      <ul className="text-sm text-ink-900 mb-2">
                        {lines.map((line, index) => (
                          <li key={index}>
                            <span className="font-medium">{line.qty}×</span> {line.name}
                            {line.notes && <span className="text-ink-400"> · {line.notes}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-ink-400 mb-2">
                        {item.items} {item.items === 1 ? "ítem" : "ítems"}
                      </p>
                    )}
                    <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-2 pt-3 border-t border-ink-900/[0.06]">
                      {mode !== "cocina" && (
                        <span className="text-sm font-medium text-ink-900 tnum flex-1">
                          {fmtMoney(item.amount)}
                        </span>
                      )}
                      {item.status === "pendiente" && canConfirm && (
                        <Button
                          onClick={() => setPendingConfirm(actionOrder)}
                          className="px-5 min-h-12 w-full min-[420px]:w-auto text-sm"
                        >
                          Confirmar recepción
                        </Button>
                      )}
                      {item.status === "cocina" && canListo && (
                        <Button
                          onClick={() => setPendingListo(actionOrder)}
                          className="px-5 min-h-12 w-full min-[420px]:w-auto text-sm"
                        >
                          Marcar listo
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={pendingConfirm !== null}
        title="Confirmar recepción"
        message={
          pendingConfirm
            ? `¿Confirmar la recepción de ${pendingConfirm.id}? Pasará a En cocina.`
            : ""
        }
        confirmLabel="Confirmar"
        onConfirm={() => pendingConfirm && confirm(pendingConfirm)}
        onCancel={() => setPendingConfirm(null)}
      />
      <ConfirmDialog
        open={pendingListo !== null}
        title="Marcar listo"
        message={
          pendingListo
            ? `¿Marcar ${pendingListo.id} como listo? Se avisará al mesero.`
            : ""
        }
        confirmLabel="Marcar listo"
        onConfirm={() => pendingListo && advance(pendingListo)}
        onCancel={() => setPendingListo(null)}
      />
    </div>
  );
}
