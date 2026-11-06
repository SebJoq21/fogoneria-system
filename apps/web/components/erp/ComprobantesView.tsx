"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea, TextInput } from "@/components/ui/fields";
import { Modal } from "@/components/ui/Modal";
import { Toolbar } from "@/components/ui/Toolbar";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniDonut } from "@/components/erp/summaries/charts";
import { comprobantesSummary } from "@/components/erp/summaries/summary-selectors";
import { HubBlocks } from "@/components/erp/workspace-ui";
import { Tabs } from "@/components/ui/Tabs";
import {
  fmtDateTime,
  fmtMoney,
  isValidDni,
  isValidRuc,
  nextReceiptNumber,
  nowIso,
  splitIgv,
} from "@/lib/domain";
import type { Receipt, ReceiptType } from "@/lib/erp";

/** Comprobantes: boletas, facturas y notas de crédito con ciclo de vida SUNAT. */
export function ComprobantesView() {
  const {
    receipts,
    setReceipts,
    annulReceipt,
    enviarSunat,
    generarResumenDiario,
    sunatContingencia,
    toggleSunatContingencia,
    notify,
  } = useModules();
  const [modalOpen, setModalOpen] = useState(false);
  const [cdrTarget, setCdrTarget] = useState<Receipt | null>(null);
  const [form, setForm] = useState({
    customer: "",
    total: "",
    source: "",
    receiptType: "03" as ReceiptType,
    docType: "" as "1" | "6" | "",
    docNumber: "",
  });
  const [annulTarget, setAnnulTarget] = useState<Receipt | null>(null);
  const [motivo, setMotivo] = useState("");
  const [tab, setTab] = useState<"panel" | "gestion">("panel");
  const summary = useMemo(() => comprobantesSummary(receipts), [receipts]);

  const bajasPendientes = receipts.filter(
    (r) => r.type === "03" && r.status === "Anulada" && r.bajaResumenId === "RC-pendiente",
  ).length;

  const nextNumber = useMemo(
    () => nextReceiptNumber(receipts, form.receiptType),
    [receipts, form.receiptType],
  );

  const docOk =
    form.docType === "" ||
    (form.docType === "1" ? isValidDni(form.docNumber) : isValidRuc(form.docNumber));
  const typeOk = form.receiptType === "03" || form.docType === "6";
  const canEmit = form.customer.trim() !== "" && Number(form.total) > 0 && docOk && typeOk;

  const emit = () => {
    if (!canEmit) return;
    const total = Number(form.total);
    const { subtotal, igv } = splitIgv(total);
    const at = nowIso();
    const id = nextReceiptNumber(receipts, form.receiptType);
    const receipt: Receipt = {
      id,
      type: form.receiptType,
      at,
      date: fmtDateTime(at),
      customer: form.customer.trim(),
      docType: form.docType,
      docNumber: form.docNumber,
      subtotal,
      igv,
      total,
      status: "Pagada",
      source: form.source.trim()
        ? /^#PD-/i.test(form.source.trim())
          ? form.source.trim()
          : `Manual · ${form.source.trim()}`
        : "Venta directa",
      estadoSunat: "en_cola",
      intentosEnvio: 0,
    };
    setReceipts([receipt, ...receipts]);
    enviarSunat(receipt);
    notify("Comprobante emitido", `${id} para ${form.customer}.`);
    setModalOpen(false);
    setForm({ customer: "", total: "", source: "", receiptType: "03", docType: "", docNumber: "" });
  };

  const annul = () => {
    if (!annulTarget || !motivo.trim()) return;
    annulReceipt(annulTarget.id, motivo.trim());
    notify("Comprobante anulado", `${annulTarget.id} · reverso de caja registrado.`);
    setAnnulTarget(null);
    setMotivo("");
  };

  const goTabla = () => {
    setTab("gestion");
    requestAnimationFrame(() => {
      document.getElementById("comp-emitidos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const docLabel = (r: Receipt) =>
    r.docType === "1"
      ? `DNI ${r.docNumber}`
      : r.docType === "6"
        ? `RUC ${r.docNumber}`
        : "Consumidor final";

  const sunatLabels: Record<
    Receipt["estadoSunat"],
    { label: string; tone: "success" | "danger" | "warning" | "neutral" }
  > = {
    aceptado: { label: "Aceptado", tone: "success" },
    rechazado: { label: "Rechazado", tone: "danger" },
    enviado: { label: "Enviado", tone: "warning" },
    en_cola: { label: "En cola", tone: "neutral" },
    anulado: { label: "Anulado", tone: "neutral" },
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
            left={
              <p className="text-sm text-ink-400">
                {receipts.length} comprobantes. Series B001 / F001 / NC01 ·{" "}
                {bajasPendientes > 0
                  ? `${bajasPendientes} baja(s) pendiente(s) de resumen diario.`
                  : "sin bajas pendientes."}
              </p>
            }
            right={
              <div className="flex flex-wrap gap-2 justify-end">
                <Button
                  variant="secondary"
                  disabled={bajasPendientes === 0}
                  onClick={() => {
                    const res = generarResumenDiario();
                    if (res) {
                      notify(
                        "Resumen diario generado",
                        `${res.resumenId} · ${res.count} baja(s) comunicada(s).`,
                      );
                    }
                  }}
                >
                  Resumen diario ({bajasPendientes})
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    toggleSunatContingencia();
                    notify(
                      sunatContingencia ? "Contingencia desactivada" : "Contingencia activada",
                      sunatContingencia
                        ? "El envío a SUNAT vuelve a estar disponible."
                        : "Los CPE quedarán en cola: la venta no se detiene.",
                    );
                  }}
                >
                  Contingencia SUNAT: {sunatContingencia ? "ON" : "OFF"}
                </Button>
                <Button onClick={() => setModalOpen(true)}>
                  + Emitir comprobante
                </Button>
              </div>
            }
          />

          <div id="comp-emitidos" className="scroll-mt-4">
            <TableCard>
              <THead>
                <tr>
                  <TH>Número</TH>
                  <TH>Fecha</TH>
                  <TH>Cliente</TH>
                  <TH>Documento</TH>
                  <TH right>Total</TH>
                  <TH>Estado</TH>
                  <TH>SUNAT</TH>
                  <TH right>Acciones</TH>
                </tr>
              </THead>
              <tbody>
                {receipts.map((r) => {
                  const sunat = sunatLabels[r.estadoSunat];
                  return (
                    <TR key={r.id}>
                      <TD tone="strong" nowrap>
                        <span className="tnum">{r.id}</span>
                        <span className="text-xs text-ink-400 ml-1.5">
                          {r.type === "07" ? "NC" : r.type === "01" ? "Factura" : "Boleta"}
                        </span>
                        {r.refId && (
                          <span className="text-xs text-ink-400 block">ref {r.refId}</span>
                        )}
                      </TD>
                      <TD tone="muted" nowrap>
                        <span className="text-nav">{r.date}</span>
                      </TD>
                      <TD tone="strong">{r.customer}</TD>
                      <TD>{docLabel(r)}</TD>
                      <TD tone="strong" nowrap className="tnum">
                        {fmtMoney(r.total)}
                      </TD>
                      <TD>
                        <Badge tone={r.status === "Pagada" ? "success" : r.status === "Anulada" ? "danger" : "neutral"} dot>
                          {r.status}
                        </Badge>
                      </TD>
                      <TD nowrap>
                        <Badge tone={sunat.tone} dot>
                          {sunat.label}
                        </Badge>
                        {r.bajaResumenId && (
                          <span className="text-xs text-ink-400 block mt-0.5">{r.bajaResumenId}</span>
                        )}
                      </TD>
                      <TD right nowrap>
                        <span className="flex items-center gap-3 justify-end">
                          {r.status !== "Anulada" &&
                            (r.estadoSunat === "en_cola" || r.estadoSunat === "rechazado") && (
                              <button
                                type="button"
                                onClick={() => enviarSunat(r)}
                                className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
                              >
                                {r.estadoSunat === "rechazado" ? "Reenviar" : "Enviar"}
                              </button>
                            )}
                          {r.cdr && (
                            <button
                              type="button"
                              onClick={() => setCdrTarget(r)}
                              className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
                            >
                              CDR
                            </button>
                          )}
                          {r.status === "Pagada" ? (
                            <button
                              type="button"
                              onClick={() => setAnnulTarget(r)}
                              className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
                            >
                              Anular
                            </button>
                          ) : (
                            r.status === "Anulada" && (
                              <span className="text-nav text-ink-400" title={r.motivoAnulacion}>
                                {r.motivoAnulacion ?? "-"}
                              </span>
                            )
                          )}
                        </span>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </TableCard>
          </div>
        </>
      )}

      {annulTarget && (
        <Modal
          onClose={() => {
            setAnnulTarget(null);
            setMotivo("");
          }}
          title={`Anular ${annulTarget.id}`}
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setAnnulTarget(null);
                  setMotivo("");
                }}
              >
                Cancelar
              </Button>
              <Button variant="danger" disabled={!motivo.trim()} onClick={annul}>
                Anular comprobante
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4">
            <p className="text-sm text-ink-600">
              {annulTarget.customer} · {fmtMoney(annulTarget.total)}. La anulación es
              irreversible, registra el reverso en caja y tiene efecto tributario:{" "}
              {annulTarget.type === "01"
                ? "se emitirá una nota de crédito (NC01) que modifica la factura."
                : "la boleta se dará de baja en el resumen diario (RC) del día."}
            </p>
            <Field label="Motivo de anulación" hint="Obligatorio para la auditoría.">
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. Error en los datos del cliente"
                rows={3}
              />
            </Field>
          </div>
        </Modal>
      )}

      {cdrTarget && cdrTarget.cdr && (
        <Modal
          onClose={() => setCdrTarget(null)}
          title={`Constancia de recepción · ${cdrTarget.id}`}
          footer={
            <Button variant="ghost" onClick={() => setCdrTarget(null)}>
              Cerrar
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="rounded-2xl border border-ink-900/10 p-3">
              <div className="flex justify-between text-nav text-ink-600">
                <span>Número de CDR</span>
                <span className="tnum">{cdrTarget.cdr.numero}</span>
              </div>
              <div className="flex justify-between text-nav text-ink-600">
                <span>Fecha</span>
                <span className="tnum">{fmtDateTime(cdrTarget.cdr.fecha)}</span>
              </div>
              <div className="flex justify-between text-nav text-ink-600">
                <span>Código de respuesta</span>
                <span className="tnum">{cdrTarget.cdr.codigo}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-ink-900">
                <span>Mensaje</span>
                <span>{cdrTarget.cdr.mensaje}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-ink-900/10 p-3">
              <div className="flex justify-between text-nav text-ink-600">
                <span>Intentos de envío</span>
                <span className="tnum">{cdrTarget.intentosEnvio}</span>
              </div>
              <div className="flex justify-between text-nav text-ink-600">
                <span>Último envío</span>
                <span className="tnum">
                  {cdrTarget.ultimoEnvio ? fmtDateTime(cdrTarget.ultimoEnvio) : "—"}
                </span>
              </div>
              {cdrTarget.bajaResumenId && (
                <div className="flex justify-between text-nav text-ink-600">
                  <span>Resumen de baja</span>
                  <span className="tnum">{cdrTarget.bajaResumenId}</span>
                </div>
              )}
              {cdrTarget.mensajeSunat && (
                <div className="flex justify-between text-nav text-ink-600">
                  <span>Detalle</span>
                  <span className="text-right ml-3">{cdrTarget.mensajeSunat}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-ink-400">
              Solo con CDR “aceptado” el comprobante tiene validez tributaria. El XML y la
              representación impresa con QR se guardan como respaldo (fase backend).
            </p>
          </div>
        </Modal>
      )}

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title={`Emitir comprobante · ${nextNumber}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!canEmit} onClick={emit}>
                Emitir
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Field label="Tipo">
                <Select
                  value={form.receiptType}
                  onChange={(e) => {
                    const t = e.target.value as ReceiptType;
                    setForm({
                      ...form,
                      receiptType: t,
                      docType: t === "01" ? "6" : form.docType === "6" ? "" : form.docType,
                      docNumber: t === "01" ? form.docNumber : form.docType === "6" ? "" : form.docNumber,
                    });
                  }}
                >
                  <option value="03">Boleta de venta</option>
                  <option value="01">Factura</option>
                </Select>
              </Field>
            </div>
            <div>
              <Field label="Documento">
                <Select
                  value={form.docType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      docType: e.target.value as "1" | "6" | "",
                      docNumber: "",
                    })
                  }
                >
                  <option value="">Consumidor final</option>
                  <option value="1">DNI</option>
                  <option value="6">RUC</option>
                </Select>
              </Field>
            </div>
            {form.docType !== "" && (
              <div className="sm:col-span-2">
                <Field
                  label={form.docType === "1" ? "Número de DNI" : "Número de RUC"}
                  hint={
                    form.docNumber && !docOk
                      ? `Documento inválido: ${form.docType === "1" ? "8 dígitos" : "11 dígitos con dígito verificador SUNAT"}.`
                      : "Se valida antes de emitir."
                  }
                >
                  <TextInput
                    type="text"
                    inputMode="numeric"
                    value={form.docNumber}
                    onChange={(e) =>
                      setForm({ ...form, docNumber: e.target.value.replace(/\D/g, "") })
                    }
                    placeholder={form.docType === "1" ? "45678901" : "20123456789"}
                    className="tnum"
                  />
                </Field>
              </div>
            )}
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
              <Field label="Total ($)" hint="Incluye IGV 18%; se desglosa al emitir.">
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
