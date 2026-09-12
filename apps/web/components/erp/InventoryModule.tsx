"use client";

import { useMemo, useState } from "react";
import {
  type StockState,
} from "@/lib/erp";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/fields";
import { Toolbar } from "@/components/ui/Toolbar";
import { TableCard, THead, TH, TR, TD } from "@/components/ui/data-table";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";
import { inventarioSummary } from "@/components/erp/summaries/summary-selectors";

const stateTone: Record<StockState, "success" | "warning" | "danger"> = {
  Óptimo: "success",
  Bajo: "warning",
  Agotado: "danger",
};

function deriveState(stock: number, min: number): StockState {
  if (stock <= 0) return "Agotado";
  if (stock < min) return "Bajo";
  return "Óptimo";
}

export function InventoryModule({ onlyCritical = false }: { onlyCritical?: boolean } = {}) {
  const { products, notify, ingredients, setIngredients, movements, setMovements } = useModules();
  const [criticalOnly] = useState(() => {
    if (onlyCritical) return true;
    try {
      if (typeof window === "undefined") return false;
      return new URLSearchParams(window.location.search).get("filtro") === "critico";
    } catch {
      return false;
    }
  });
  const [adjustId, setAdjustId] = useState<number | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeDish, setRecipeDish] = useState(products[0]?.name ?? "");
  const [recipeLines, setRecipeLines] = useState<{ ingredientId: number; qty: string }[]>([
    { ingredientId: ingredients[0]?.id ?? 1, qty: "" },
  ]);
  const visible = criticalOnly ? ingredients.filter((i) => i.state !== "Óptimo") : ingredients;

  const critical = ingredients.filter((i) => i.state !== "Óptimo").length;
  const adjusting = ingredients.find((i) => i.id === adjustId);

  const applyAdjust = () => {
    const qty = Number(adjustQty);
    if (!adjusting || Number.isNaN(qty)) return;
    const next = Math.max(0, adjusting.stock + qty);
    setIngredients(
      ingredients.map((i) =>
        i.id === adjusting.id
          ? { ...i, stock: next, state: deriveState(next, i.min) }
          : i,
      ),
    );
    setMovements([
      { id: Math.max(0, ...movements.map((m) => m.id)) + 1, datetime: "Ahora mismo", type: "Ajuste", ingredient: adjusting.name, qty: `${qty > 0 ? "+" : ""}${qty} ${adjusting.unit}`, reason: "Ajuste manual de stock" },
      ...movements,
    ]);
    notify("Stock ajustado", `${adjusting.name}: nuevo stock ${next} ${adjusting.unit}.`);
    setAdjustId(null);
    setAdjustQty("");
  };

  const summary = useMemo(() => inventarioSummary(ingredients), [ingredients]);

  return (
    <div>
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Stock por estado"
        chartSubtitle="Óptimo, bajo y agotado de un vistazo"
        ariaLabel="Resumen de inventario"
      >
        <MiniBars data={summary.bars} label="Insumos por estado de stock" />
      </ModuleSummary>
      {critical > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{critical} insumo{critical === 1 ? " ha" : "s han"} alcanzado el nivel crítico</strong> de
            agotamiento. Revisa la tabla para reponer stock.
          </p>
        </div>
      )}

      <Toolbar
        left={<h3 className="text-sm font-medium text-ink-900">Stock de ingredientes</h3>}
        right={
          <Button
            variant="secondary"
            onClick={() => setRecipeOpen(true)}
            className="border-ink-900/20 hover:border-ink-900 w-max"
          >
            Escandallo (ficha técnica)
          </Button>
        }
      />

      <TableCard>
        <THead>
          <tr>
            <TH>Ingrediente</TH>
            <TH>Categoría</TH>
            <TH>Stock actual</TH>
            <TH>Mínimo</TH>
            <TH>Unidad</TH>
            <TH>Estado</TH>
            <TH right>Ajuste</TH>
          </tr>
        </THead>
        <tbody>
          {visible.map((i) => (
            <TR key={i.id}>
              <TD tone="strong">{i.name}</TD>
              <TD>{i.category}</TD>
              <TD tone="strong" className="tnum">{i.stock}</TD>
              <TD tone="muted" className="tnum">{i.min}</TD>
              <TD>{i.unit}</TD>
              <TD>
                <Badge tone={stateTone[i.state]} dot>
                  {i.state}
                </Badge>
              </TD>
              <TD right nowrap>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustId(i.id);
                    setAdjustQty("");
                  }}
                  className="text-nav font-medium text-ink-900 hover:underline cursor-pointer whitespace-nowrap"
                >
                  + Ajustar Stock
                </button>
              </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>

      {adjusting && (
        <Modal
          onClose={() => setAdjustId(null)}
          title={`Ajustar stock · ${adjusting.name}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setAdjustId(null)}>
                Cancelar
              </Button>
              <Button
                onClick={applyAdjust}
                disabled={adjustQty === "" || Number.isNaN(Number(adjustQty))}
              >
                Aplicar ajuste
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-600 mb-1">
            Stock actual: <strong className="text-ink-900">{adjusting.stock} {adjusting.unit}</strong>
          </p>
          <p className="text-xs text-ink-400 mb-4">Usa valores positivos para ingresar y negativos para descontar.</p>
          <TextInput
            type="number"
            value={adjustQty}
            onChange={(e) => setAdjustQty(e.target.value)}
            placeholder="Ej. 5 o -2"
          />
        </Modal>
      )}

      {recipeOpen && (
        <Modal
          onClose={() => setRecipeOpen(false)}
          title="Escandallo · ficha técnica del plato"
          footer={
            <>
              <Button variant="ghost" onClick={() => setRecipeOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  notify("Escandallo guardado", `La ficha técnica de "${recipeDish}" descuenta stock automáticamente.`);
                  setRecipeOpen(false);
                }}
              >
                Guardar ficha
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Plato del menú">
              <Select
                value={recipeDish}
                onChange={(e) => setRecipeDish(e.target.value)}
              >
                {products.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            {recipeLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_100px] gap-2">
                <Select
                  value={line.ingredientId}
                  onChange={(e) =>
                    setRecipeLines(
                      recipeLines.map((l, i) =>
                        i === idx ? { ...l, ingredientId: Number(e.target.value) } : l,
                      ),
                    )
                  }
                >
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                </Select>
                <TextInput
                  type="number"
                  value={line.qty}
                  onChange={(e) =>
                    setRecipeLines(
                      recipeLines.map((l, i) => (i === idx ? { ...l, qty: e.target.value } : l)),
                    )
                  }
                  placeholder="Cant."
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setRecipeLines([...recipeLines, { ingredientId: ingredients[0].id, qty: "" }])
              }
              className="text-nav font-medium text-ink-900 hover:underline self-start cursor-pointer"
            >
              + Añadir ingrediente
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
