"use client";

import { useMemo, useState } from "react";
import { Progress } from "@/components/ui/Progress";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/fields";
import { Toolbar } from "@/components/ui/Toolbar";
import { Toggle } from "@/components/ui/Toggle";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { initialPromos } from "@/lib/erp";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { promosSummary } from "@/components/erp/summaries/summary-selectors";

/** Promociones: cupones con cupo + promociones programadas con vigencia. */
export function PromocionesView() {
  const { coupons, setCoupons, notify } = useModules();
  const [promos, setPromos] = useState(initialPromos);
  const [modalOpen, setModalOpen] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      return new URLSearchParams(window.location.search).get("nuevo") === "1";
    } catch {
      return false;
    }
  });
  const [form, setForm] = useState({ code: "", discount: "", limit: "", expires: "" });

  const createCoupon = () => {
    if (!form.code || !form.discount) return;
    setCoupons([
      { code: form.code.toUpperCase(), discount: form.discount, used: 0, limit: Number(form.limit) || 100, expires: form.expires || "Sin vencimiento" },
      ...coupons,
    ]);
    notify("Cupón creado", `El cupón ${form.code.toUpperCase()} ya está activo.`);
    setModalOpen(false);
    setForm({ code: "", discount: "", limit: "", expires: "" });
  };

  const summary = useMemo(
    () => promosSummary(coupons, promos.filter((p) => p.active).length),
    [coupons, promos],
  );

  return (
    <div>
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Canjes por cupón"
        chartSubtitle="Qué promociones mueven tu franquicia"
        ariaLabel="Resumen de promociones"
      >
        <MiniBars data={summary.bars} label="Canjes por cupón" />
      </ModuleSummary>
      <Toolbar
        left={<h3 className="text-sm font-medium text-ink-900">Cupones activos</h3>}
        right={
          <Button onClick={() => setModalOpen(true)}>
            + Crear Cupón
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {coupons.map((c) => (
          <Card key={c.code}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-ink-900 bg-primary/[0.05] px-2.5 py-1 rounded-md">
                {c.code}
              </span>
              <span className="text-sm font-medium text-ink-900">{c.discount}</span>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-ink-400 mb-1.5">
                <span>Límite de usos</span>
                <span className="font-medium text-ink-600">
                  {c.used}/{c.limit}
                </span>
              </div>
              <Progress value={c.used} max={c.limit} />
            </div>
            <p className="text-xs text-ink-400 mt-3">Vence: {c.expires}</p>
          </Card>
        ))}
      </div>

      <Toolbar
        left={<h3 className="text-sm font-medium text-ink-900">Programadas por horario</h3>}
      />

      <TableCard>
        <THead>
          <tr>
            <TH>Promoción</TH>
            <TH>Beneficio</TH>
            <TH>Vigencia</TH>
            <TH right>Activa</TH>
          </tr>
        </THead>
        <tbody>
          {promos.map((p) => (
            <TR key={p.id}>
              <TD tone="strong">{p.name}</TD>
              <TD>{p.kind}</TD>
              <TD tone="muted" nowrap>
                <span className="text-nav">{p.validity}</span>
              </TD>
              <TD right>
                <Toggle
                  checked={p.active}
                  onChange={() =>
                    setPromos(promos.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)))
                  }
                  label={`Activar ${p.name}`}
                />
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>

      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title="Crear cupón"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!form.code || !form.discount}
                onClick={createCoupon}
              >
                Crear cupón
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Field label="Código">
                <TextInput
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="BURGER10"
                  className="uppercase"
                />
              </Field>
            </div>
            <div>
              <Field label="Descuento">
                <TextInput
                  type="text"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  placeholder="10% OFF"
                />
              </Field>
            </div>
            <div>
              <Field label="Límite de usos">
                <TextInput
                  type="number"
                  value={form.limit}
                  onChange={(e) => setForm({ ...form, limit: e.target.value })}
                  placeholder="100"
                />
              </Field>
            </div>
            <div>
              <Field label="Vencimiento">
                <TextInput
                  type="text"
                  value={form.expires}
                  onChange={(e) => setForm({ ...form, expires: e.target.value })}
                  placeholder="30 Nov 2026"
                />
              </Field>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
