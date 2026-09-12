"use client";

import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";

/** Informe valorizado: detalle por producto y/o resumen por categoría. */
export function ValorizadoView({ section }: { section: "detalle" | "resumen" }) {
  const { products, priceLists, priceOf, categoryNameOf } = useModules();
  const active = priceLists.find((l) => l.active);
  const activos = products.filter((p) => p.status === "Activo");
  const total = activos.reduce((sum, p) => sum + priceOf(p.id), 0);

  const byCategory = activos.reduce<Record<string, { name: string; count: number; total: number }>>(
    (acc, p) => {
      const key = p.categoryId;
      if (!acc[key]) acc[key] = { name: categoryNameOf(key), count: 0, total: 0 };
      acc[key].count += 1;
      acc[key].total += priceOf(p.id);
      return acc;
    },
    {},
  );

  if (section === "resumen") {
    return (
      <div>
      <ModuleSummary
        kpis={[
          { label: "Platos valorizados", value: String(activos.length), hint: active?.name ?? "" },
          { label: "Total carta", value: `$${total.toFixed(2)}`, hint: "lista activa" },
          { label: "Categorías", value: String(Object.keys(byCategory).length), hint: "con platos" },
          { label: "Precio prom.", value: activos.length === 0 ? "—" : `$${(total / activos.length).toFixed(2)}`, hint: "por plato" },
        ]}
        chartTitle="Subtotal por categoría"
        chartSubtitle={`Valorizado en lista ${active?.name ?? "—"}`}
        ariaLabel="Resumen valorizado"
      >
        <MiniBars data={Object.values(byCategory).map((c) => ({ name: c.name.slice(0, 10), v: Math.round(c.total) }))} label="Subtotal por categoría" />
      </ModuleSummary>
      <TableCard>
        <THead>
          <tr>
            <TH>Categoría</TH>
            <TH>Platos</TH>
            <TH right>Subtotal ({active?.name ?? "—"})</TH>
          </tr>
        </THead>
        <tbody>
          {Object.values(byCategory).map((c) => (
            <TR key={c.name}>
              <TD tone="strong">{c.name}</TD>
              <TD className="tnum">{c.count}</TD>
              <TD tone="strong" right nowrap className="tnum">
                ${c.total.toFixed(2)}
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>
      </div>
    );
  }

  return (
    <div>
      <ModuleSummary
        kpis={[
          { label: "Platos valorizados", value: String(activos.length), hint: active?.name ?? "" },
          { label: "Total carta", value: `$${total.toFixed(2)}`, hint: "lista activa" },
          { label: "Categorías", value: String(Object.keys(byCategory).length), hint: "con platos" },
          { label: "Precio prom.", value: activos.length === 0 ? "—" : `$${(total / activos.length).toFixed(2)}`, hint: "por plato" },
        ]}
        chartTitle="Detalle valorizado"
        chartSubtitle={`Lista ${active?.name ?? "—"} · total $${total.toFixed(2)}`}
        ariaLabel="Resumen detalle valorizado"
      >
        <MiniBars data={Object.values(byCategory).map((c) => ({ name: c.name.slice(0, 10), v: Math.round(c.total) }))} label="Subtotal por categoría" />
      </ModuleSummary>
    <TableCard>
      <THead>
        <tr>
            <TH>SKU</TH>
            <TH>Plato</TH>
          <TH>Categoría</TH>
          <TH right>Precio ({active?.name ?? "—"})</TH>
        </tr>
      </THead>
      <tbody>
        {activos.map((p) => (
          <TR key={p.id}>
            <TD tone="muted" nowrap>
              <span className="text-nav">{p.sku}</span>
            </TD>
            <TD tone="strong">{p.name}</TD>
            <TD>
              <span className="text-nav">{categoryNameOf(p.categoryId)}</span>
            </TD>
            <TD tone="strong" right nowrap className="tnum">
              ${priceOf(p.id).toFixed(2)}
            </TD>
          </TR>
        ))}
      </tbody>
      <tfoot>
        <tr className="bg-primary/[0.03]">
          <TD tone="strong" colSpan={3}>
            Total carta
          </TD>
          <TD tone="strong" right className="tnum">
            ${total.toFixed(2)}
          </TD>
        </tr>
      </tfoot>
    </TableCard>
    </div>
  );
}
