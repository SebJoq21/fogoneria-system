"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/fields";
import { Toolbar } from "@/components/ui/Toolbar";
import { ModuleSummary } from "@/components/dashboard/summaries/ModuleSummary";
import { MiniBars } from "@/components/dashboard/summaries/charts";
import { validarGrupoModificador } from "@fogoneria/contracts/catalog";
import { useCatalogo } from "./hooks";

/** Maestro de modificadores: grupos (tamaño, extras…) con opciones y precio adicional. */
export function ModifiersView() {
  const {
    grupos,
    platos,
    notificar,
    crearGrupo,
    actualizarGrupo,
    borrarGrupo,
    cargando,
    error,
  } = useCatalogo();
  const [groupModal, setGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [saving, setSaving] = useState(false);
  const [optionDrafts, setOptionDrafts] = useState<Record<string, { name: string; extra: string }>>({});
  const [pendingRemove, setPendingRemove] = useState<{ groupId: string; optionId: string; name: string } | null>(null);
  const [pendingGroup, setPendingGroup] = useState<{ id: string; name: string } | null>(null);

  // Envia el id de cada opción existente: quitarlo borraría la opción y la API
  // lo rechaza si ya se usó en órdenes.
  const optionsPayload = (id: string, omitOptionId?: string) => {
    const group = grupos.find((g) => g.id === id);
    if (!group) return null;
    return group.opciones
      .filter((o) => o.id !== omitOptionId)
      .map((o) => ({ id: o.id, nombre: o.nombre, extra: o.extra }));
  };

  const addGroup = async () => {
    if (validarGrupoModificador({ nombre: groupName })) return;
    setSaving(true);
    try {
      await crearGrupo({ nombre: groupName.trim(), obligatorio: false, multiple: true });
      notificar("Grupo creado", `"${groupName}" añadido a modificadores.`);
      setGroupName("");
      setGroupModal(false);
    } catch (error) {
      notificar("No se pudo crear el grupo", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const patchGroup = async (id: string, patch: { obligatorio?: boolean; multiple?: boolean }) => {
    try {
      await actualizarGrupo(id, patch);
    } catch (error) {
      notificar("No se pudo actualizar el grupo", error instanceof Error ? error.message : "Error inesperado");
    }
  };

  const addOption = async (groupId: string) => {
    const draft = optionDrafts[groupId] ?? { name: "", extra: "" };
    if (!draft.name.trim()) return;
    const options = optionsPayload(groupId);
    if (!options) return;
    try {
      await actualizarGrupo(groupId, {
        opciones: [...options, { nombre: draft.name.trim(), extra: Number(draft.extra) || 0 }],
      });
      setOptionDrafts({ ...optionDrafts, [groupId]: { name: "", extra: "" } });
    } catch (error) {
      notificar("No se pudo añadir la opción", error instanceof Error ? error.message : "Error inesperado");
    }
  };

  const removeOption = async (groupId: string, optionId: string) => {
    const options = optionsPayload(groupId, optionId);
    setPendingRemove(null);
    if (!options) return;
    try {
      await actualizarGrupo(groupId, { opciones: options });
      notificar("Opción quitada", "Se retiró del grupo de modificadores.");
    } catch (error) {
      notificar("No se pudo quitar la opción", error instanceof Error ? error.message : "Error inesperado");
    }
  };

  const removeGroup = async (id: string) => {
    setPendingGroup(null);
    try {
      await borrarGrupo(id);
      notificar("Grupo desactivado", "Se retiró del maestro de modificadores.");
    } catch (error) {
      notificar("No se pudo desactivar el grupo", error instanceof Error ? error.message : "Error inesperado");
    }
  };

  const summary = useMemo(() => {
    const totalOptions = grupos.reduce((s, g) => s + g.opciones.length, 0);
    return {
      kpis: [
        { label: "Grupos", value: String(grupos.length), hint: "tamaños, extras…" },
        { label: "Opciones", value: String(totalOptions), hint: "en total" },
        { label: "Obligatorios", value: String(grupos.filter((g) => g.obligatorio).length), hint: "requieren elección" },
        { label: "En platos", value: String(platos.filter((p) => p.grupoIds.length > 0).length), hint: "con modificadores" },
      ],
      bars: grupos.slice(0, 6).map((g) => ({ name: g.nombre.slice(0, 10), v: g.opciones.length })),
    };
  }, [grupos, platos]);

  return (
    <div>
      {error && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {error}
        </p>
      )}
      {cargando && grupos.length === 0 && (
        <p className="text-sm text-ink-400 mb-4">Cargando modificadores…</p>
      )}
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
            {grupos.length} grupos · se asignan desde el maestro de platos.
          </p>
        }
        right={
          <Button onClick={() => setGroupModal(true)}>
            + Nuevo grupo
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {grupos.map((g) => {
          const usedBy = platos.filter((p) => p.grupoIds.includes(g.id)).length;
          const draft = optionDrafts[g.id] ?? { name: "", extra: "" };
          return (
            <Card key={g.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <h3 className="text-sm font-medium text-ink-900">{g.nombre}</h3>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {usedBy} plato{usedBy === 1 ? "" : "s"} lo usan
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  <Badge tone="neutral">{g.multiple ? "Múltiple" : "Único"}</Badge>
                  <button
                    type="button"
                    onClick={() => setPendingGroup({ id: g.id, name: g.nombre })}
                    className="text-ink-400 hover:text-ink-900 font-medium text-nav cursor-pointer"
                  >
                    Quitar
                  </button>
                </span>
              </div>

              <div className="flex gap-4 my-3">
                <label className="flex items-center gap-2 text-nav text-ink-600">
                  <Toggle checked={g.obligatorio} onChange={(v) => patchGroup(g.id, { obligatorio: v })} label="Obligatorio" />
                  Obligatorio
                </label>
                <label className="flex items-center gap-2 text-nav text-ink-600">
                  <Toggle checked={g.multiple} onChange={(v) => patchGroup(g.id, { multiple: v })} label="Selección múltiple" />
                  Múltiple
                </label>
              </div>

              <ul className="flex flex-col gap-2 mb-3">
                {g.opciones.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-2 bg-primary/[0.03] rounded-full pl-4 pr-2 py-1"
                  >
                    <span className="text-sm text-ink-900">{o.nombre}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-nav text-ink-400 tnum">
                        {o.extra === 0 ? "Sin adicional" : `+$${o.extra.toFixed(2)}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingRemove({ groupId: g.id, optionId: o.id, name: o.nombre })}
                        aria-label={`Quitar ${o.nombre}`}
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

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Quitar opción"
        message={
          pendingRemove
            ? `¿Quitar "${pendingRemove.name}" del grupo? Los platos que la usan dejarán de ofrecerla.`
            : ""
        }
        confirmLabel="Quitar"
        danger
        onConfirm={() => pendingRemove && removeOption(pendingRemove.groupId, pendingRemove.optionId)}
        onCancel={() => setPendingRemove(null)}
      />

      <ConfirmDialog
        open={pendingGroup !== null}
        title="Desactivar grupo"
        message={
          pendingGroup
            ? `¿Desactivar "${pendingGroup.name}"? Los platos que lo usan dejarán de ofrecerlo.`
            : ""
        }
        confirmLabel="Desactivar"
        danger
        onConfirm={() => pendingGroup && removeGroup(pendingGroup.id)}
        onCancel={() => setPendingGroup(null)}
      />

      {groupModal && (
        <Modal
          onClose={() => setGroupModal(false)}
          title="Nuevo grupo de modificadores"
          footer={
            <>
              <Button variant="ghost" onClick={() => setGroupModal(false)}>
                Cancelar
              </Button>
              <Button disabled={!groupName.trim() || saving} onClick={addGroup}>
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
