"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/fields";
import { Toolbar } from "@/components/ui/Toolbar";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ModuleSummary } from "@/components/erp/summaries/ModuleSummary";
import { MiniBars } from "@/components/erp/summaries/charts";

/** Maestro de modificadores: grupos (tamaño, extras…) con opciones y precio adicional. */
export function ModifiersView() {
  const { modifierGroups, setModifierGroups, products, notify } = useModules();
  const [groupModal, setGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [optionDrafts, setOptionDrafts] = useState<Record<string, { name: string; extra: string }>>({});

  const addGroup = () => {
    if (!groupName.trim()) return;
    const id = groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    setModifierGroups([...modifierGroups, { id, name: groupName, required: false, multi: true, options: [] }]);
    notify("Grupo creado", `"${groupName}" añadido a modificadores.`);
    setGroupName("");
    setGroupModal(false);
  };

  const patchGroup = (id: string, patch: Partial<(typeof modifierGroups)[number]>) => {
    setModifierGroups(modifierGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const addOption = (groupId: string) => {
    const draft = optionDrafts[groupId] ?? { name: "", extra: "" };
    if (!draft.name.trim()) return;
    setModifierGroups(
      modifierGroups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: [
                ...g.options,
                { id: `${groupId}-${Date.now()}`, name: draft.name, extra: Number(draft.extra) || 0 },
              ],
            }
          : g,
      ),
    );
    setOptionDrafts({ ...optionDrafts, [groupId]: { name: "", extra: "" } });
  };

  const removeOption = (groupId: string, optionId: string) => {
    setModifierGroups(
      modifierGroups.map((g) =>
        g.id === groupId ? { ...g, options: g.options.filter((o) => o.id !== optionId) } : g,
      ),
    );
  };

  const summary = useMemo(() => {
    const totalOptions = modifierGroups.reduce((s, g) => s + g.options.length, 0);
    return {
      kpis: [
        { label: "Grupos", value: String(modifierGroups.length), hint: "tamaños, extras…" },
        { label: "Opciones", value: String(totalOptions), hint: "en total" },
        { label: "Obligatorios", value: String(modifierGroups.filter((g) => g.required).length), hint: "requieren elección" },
        { label: "En platos", value: String(products.filter((p) => p.modifierGroupIds.length > 0).length), hint: "con modificadores" },
      ],
      bars: modifierGroups.slice(0, 6).map((g) => ({ name: g.name.slice(0, 10), v: g.options.length })),
    };
  }, [modifierGroups, products]);

  return (
    <div>
      <ModuleSummary
        kpis={summary.kpis}
        chartTitle="Opciones por grupo"
        chartSubtitle="Cómo personaliza tu carta"
        ariaLabel="Resumen de modificadores"
      >
        <MiniBars data={summary.bars} label="Opciones por grupo de modificadores" />
      </ModuleSummary>
      <Toolbar
        left={
          <p className="text-sm text-ink-400">
            {modifierGroups.length} grupos · se asignan desde el maestro de platos.
          </p>
        }
        right={
          <Button onClick={() => setGroupModal(true)}>
            + Nuevo grupo
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {modifierGroups.map((g) => {
          const usedBy = products.filter((p) => p.modifierGroupIds.includes(g.id)).length;
          const draft = optionDrafts[g.id] ?? { name: "", extra: "" };
          return (
            <Card key={g.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <h3 className="text-sm font-medium text-ink-900">{g.name}</h3>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {usedBy} plato{usedBy === 1 ? "" : "s"} lo usan
                  </p>
                </div>
                <Badge tone="neutral">{g.multi ? "Múltiple" : "Único"}</Badge>
              </div>

              <div className="flex gap-4 my-3">
                <label className="flex items-center gap-2 text-nav text-ink-600">
                  <Toggle checked={g.required} onChange={(v) => patchGroup(g.id, { required: v })} label="Obligatorio" />
                  Obligatorio
                </label>
                <label className="flex items-center gap-2 text-nav text-ink-600">
                  <Toggle checked={g.multi} onChange={(v) => patchGroup(g.id, { multi: v })} label="Selección múltiple" />
                  Múltiple
                </label>
              </div>

              <ul className="flex flex-col gap-2 mb-3">
                {g.options.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-2 bg-primary/[0.03] rounded-full pl-4 pr-2 py-1"
                  >
                    <span className="text-sm text-ink-900">{o.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-nav text-ink-400 tnum">
                        {o.extra === 0 ? "Sin adicional" : `+$${o.extra.toFixed(2)}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeOption(g.id, o.id)}
                        aria-label={`Quitar ${o.name}`}
                        className="text-ink-400 hover:text-ink-900 p-2 cursor-pointer"
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="grid grid-cols-[1fr_110px_auto] gap-2">
                <TextInput
                  type="text"
                  value={draft.name}
                  onChange={(e) =>
                    setOptionDrafts({ ...optionDrafts, [g.id]: { ...draft, name: e.target.value } })
                  }
                  placeholder="Nueva opción"
                />
                <TextInput
                  type="number"
                  value={draft.extra}
                  onChange={(e) =>
                    setOptionDrafts({ ...optionDrafts, [g.id]: { ...draft, extra: e.target.value } })
                  }
                  placeholder="+$"
                  className="tnum"
                />
                <Button
                  disabled={!draft.name.trim()}
                  onClick={() => addOption(g.id)}
                  className="px-4"
                >
                  Añadir
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {groupModal && (
        <Modal
          onClose={() => setGroupModal(false)}
          title="Nuevo grupo de modificadores"
          footer={
            <>
              <Button variant="ghost" onClick={() => setGroupModal(false)}>
                Cancelar
              </Button>
              <Button disabled={!groupName.trim()} onClick={addGroup}>
                Crear grupo
              </Button>
            </>
          }
        >
          <Field label="Nombre del grupo">
            <TextInput
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Ej. Término, Salsas, Agregados"
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}
