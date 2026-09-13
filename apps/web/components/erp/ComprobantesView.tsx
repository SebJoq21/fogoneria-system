"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/fields";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toolbar } from "@/components/ui/Toolbar";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniDonut } from "@/components/erp/summaries/charts";
import { comprobantesSummary } from "@/components/erp/summaries/summary-selectors";
import { HubBlocks } from "@/components/erp/workspace-ui";
import { Tabs } from "@/components/ui/Tabs";

/** Comprobantes: boletas y facturas de venta con correlativo. */
export function ComprobantesView() {
  const { receipts, setReceipts, notify } = useModules();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ customer: "", total: "", source: "" });
  const [pendingAnnul, setPendingAnnul] = useState<{ id: string; total: string } | null>(null);
  const [tab, setTab] = useState<"panel" | "gestion">("panel");
  const summary = useMemo(() => comprobantesSummary(receipts), [receipts]);

  const nextNumber = useMemo(() => {
    const nums = receipts.map((r) => Number(String(r.id).split("-")[1]) || 0);
    return `B001-${Math.max(1042, ...nums) + 1}`;
  }, [receipts]);

  const emit = () => {
    if (!form.customer.trim() || !Number(form.total)) return;
    setReceipts([
      { id: nextNumber, date: "Ahora mismo", customer: form.customer, total: `$${Number(form.total).toFixed(2)}`, status: "Pagada", source: form.source.trim() ? (/^#PD-/i.test(form.source.trim()) ? form.source.trim() : `Manual · ${form.source.trim()}`) : "Venta directa" },
      ...receipts,
    ]);
    notify("Comprobante emitido", `${nextNumber} para ${form.customer}.`);
    setModalOpen(false);
    setForm({ customer: "", total: "", source: "" });
  };

  const annul = (id: string) => {
    setReceipts(receipts.map((r) => (r.id === id ? { ...r, status: "Anulada" as const } : r)));
    setPendingAnnul(null);
    notify("Comprobante anulado", `${id} marcado como Anulada.`);
  };

  const goTabla = () => {
    setTab("gestion");
    requestAnimationFrame(() => {
      document.getElementById("comp-emitidos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div>
      <div className="mb-6">
        <Tabs
          options={[
            { id: "panel", label: "Panel" },
            { id: "gestion", label: "Emitir comprobante" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "panel" && (
      <>
      <div id="comp-resumen" className="scroll-mt-4">
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Pagadas vs anuladas"
        chartSubtitle="Estado de tu facturación"
        ariaLabel="Resumen de comprobantes"
      >
        <MiniDonut data={summary.donut} label="Comprobantes pagados y anulados" />
      </ModuleSummary>
      </div>
      <div className="mt-8">
      <HubBlocks
        acceso={[{ label: "Emitir comprobante", onSelect: () => setTab("gestion") }]}
        informes={[
          { label: "Pagadas vs anuladas", href: "#comp-resumen" },
          { label: "Emitidos", onSelect: goTabla },
        ]}
      />
      </div>
      </>
      )}

      {tab === "gestion" && (
      <>
      <Toolbar
        left={<p className="text-sm text-ink-400">{receipts.length} comprobantes emitidos.</p>}
        right={
          <Button onClick={() => setModalOpen(true)}>
            + Emitir comprobante
          </Button>
        }
      />

      <div id="comp-emitidos" className="scroll-mt-4">
      <TableCard>
        <THead>
          <tr>
            <TH>Número</TH>
            <TH>Fecha</TH>
            <TH>Cliente</TH>
            <TH>Origen</TH>
            <TH>Total</TH>
            <TH>Estado</TH>
            <TH right>Acciones</TH>
          </tr>
        </THead>
        <tbody>
          {receipts.map((r) => (
            <TR key={r.id}>
              <TD tone="strong" nowrap className="tnum">{r.id}</TD>
              <TD tone="muted" nowrap>
                <span className="text-nav">{r.date}</span>
              </TD>
              <TD tone="strong">{r.customer}</TD>
              <TD>{r.source}</TD>
              <TD tone="strong" nowrap className="tnum">{r.total}</TD>
              <TD>
                <Badge tone={r.status === "Pagada" ? "success" : "danger"} dot>
                  {r.status}
                </Badge>
              </TD>
              <TD right nowrap>
                {r.status === "Pagada" ? (
                  <button
                    type="button"
                    onClick={() => setPendingAnnul({ id: r.id, total: r.total })}
                    className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
                  >
                    Anular
                  </button>
                ) : (
                  <span className="text-nav text-ink-400">—</span>
                )}
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>
      </div>
      </>
      )}

      <ConfirmDialog
        open={pendingAnnul !== null}
        title="Anular comprobante"
        message={
          pendingAnnul
            ? `¿Anular el comprobante ${pendingAnnul.id} (${pendingAnnul.total})? Es irreversible y tiene efecto tributario.`
            : ""
        }
        confirmLabel="Anular"
        danger
        onConfirm={() => pendingAnnul && annul(pendingAnnul.id)}
        onCancel={() => setPendingAnnul(null)}
      />

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title={`Emitir comprobante · ${nextNumber}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!form.customer.trim() || !Number(form.total)}
                onClick={emit}
              >
                Emitir
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Field label="Cliente">
                <TextInput
                  type="text"
                  value={form.customer}
                  onChange={(e) => setForm({ ...form, customer: e.target.value })}
                  placeholder="Ej. Mesa 4"
                />
              </Field>
            </div>
            <div>
              <Field label="Total ($)">
                <TextInput
                  type="number"
                  value={form.total}
                  onChange={(e) => setForm({ ...form, total: e.target.value })}
                  placeholder="0.00"
                  className="tnum"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Origen">
                <TextInput
                  type="text"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="Ej. Orden #PD-1043"
                />
              </Field>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
