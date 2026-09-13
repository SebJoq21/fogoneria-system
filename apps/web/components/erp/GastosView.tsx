"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { Modal } from "@/components/ui/Modal";
import { Toolbar } from "@/components/ui/Toolbar";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { expenseCategories } from "@/lib/erp";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { gastosSummary } from "@/components/erp/summaries/summary-selectors";
import { HubBlocks } from "@/components/erp/workspace-ui";
import { Tabs } from "@/components/ui/Tabs";

/** Gastos: egresos operativos por categoría y proveedor. */
export function GastosView() {
  const { expenses, setExpenses, notify } = useModules();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ category: expenseCategories[0], supplier: "", amount: "", status: "Pagado" as "Pagado" | "Pendiente" });
  const [tab, setTab] = useState<"panel" | "gestion">("panel");

  const summary = useMemo(() => gastosSummary(expenses), [expenses]);
  const total = expenses.reduce((s, e) => s + Number(e.amount.replace("$", "")) || 0, 0);

  const save = () => {
    if (!form.supplier.trim() || !Number(form.amount)) return;
    setExpenses([
      { id: Date.now(), date: "Hoy", category: form.category, supplier: form.supplier, amount: `$${Number(form.amount).toFixed(2)}`, status: form.status },
      ...expenses,
    ]);
    notify("Gasto registrado", `${form.category} · ${form.supplier}.`);
    setModalOpen(false);
    setForm({ category: expenseCategories[0], supplier: "", amount: "", status: "Pagado" });
  };

  const goTabla = () => {
    setTab("gestion");
    requestAnimationFrame(() => {
      document.getElementById("gastos-tabla")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div>
      <div className="mb-6">
        <Tabs
          options={[
            { id: "panel", label: "Panel" },
            { id: "gestion", label: "Registrar gasto" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "panel" && (
      <>
      <div id="gastos-resumen" className="scroll-mt-4">
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Gastos por categoría"
        chartSubtitle="Dónde se va el dinero de tu franquicia"
        ariaLabel="Resumen de gastos"
      >
        <MiniBars data={summary.bars} label="Gastos por categoría" />
      </ModuleSummary>
      </div>
      <div className="mt-8">
      <HubBlocks
        acceso={[{ label: "Registrar gasto", onSelect: () => setTab("gestion") }]}
        informes={[
          { label: "Gastos por categoría", href: "#gastos-resumen" },
          { label: "Gastos registrados", onSelect: goTabla },
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
            Total registrado: <strong className="text-ink-900 tnum">${total.toFixed(2)}</strong>
          </p>
        }
        right={
          <Button onClick={() => setModalOpen(true)}>
            + Registrar gasto
          </Button>
        }
      />

      <div id="gastos-tabla" className="scroll-mt-4">
      <TableCard>
        <THead>
          <tr>
            <TH>Fecha</TH>
            <TH>Categoría</TH>
            <TH>Proveedor / Concepto</TH>
            <TH>Monto</TH>
            <TH>Estado</TH>
          </tr>
        </THead>
        <tbody>
          {expenses.map((e) => (
            <TR key={e.id}>
              <TD tone="muted" nowrap>
                <span className="text-nav">{e.date}</span>
              </TD>
              <TD>
                <span className="bg-primary/[0.05] px-2.5 py-1 rounded-md text-xs font-medium text-ink-600">
                  {e.category}
                </span>
              </TD>
              <TD tone="strong">{e.supplier}</TD>
              <TD tone="strong" nowrap className="tnum">{e.amount}</TD>
              <TD>
                <Badge tone={e.status === "Pagado" ? "success" : "warning"} dot>
                  {e.status}
                </Badge>
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>
      </div>
      </>
      )}

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title="Registrar gasto"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!form.supplier.trim() || !Number(form.amount)}
                onClick={save}
              >
                Guardar gasto
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Field label="Categoría">
                <Select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {expenseCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div>
              <Field label="Estado">
                <Select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as "Pagado" | "Pendiente" })}
                >
                  <option value="Pagado">Pagado</option>
                  <option value="Pendiente">Pendiente</option>
                </Select>
              </Field>
            </div>
            <div>
              <Field label="Proveedor / Concepto">
                <TextInput
                  type="text"
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  placeholder="Ej. AgroAndina"
                />
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
          </div>
        </Modal>
      )}
    </div>
  );
}
