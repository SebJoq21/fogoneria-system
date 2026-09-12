"use client";

import { TableCard, THead, TH, TR, TD, RowActions } from "@/components/ui/data-table";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput, Textarea } from "@/components/ui/fields";
import { Modal } from "@/components/ui/Modal";

import { useState } from "react";
import type { MenuItem } from "@/lib/dashboard";

export function MenuEditor({
  menuItems,
  setMenuItems,
  onPreview,
  onNotify,
}: {
  menuItems: MenuItem[];
  setMenuItems: (items: MenuItem[]) => void;
  onPreview: () => void;
  onNotify: (title: string, message: string) => void;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: null as number | null,
    name: "",
    price: "",
    category: "",
    description: "",
  });

  const handleSave = () => {
    if (!formData.name || !formData.price || !formData.category) return;
    if (formData.id) {
      setMenuItems(
        menuItems.map((item) =>
          item.id === formData.id
            ? {
                ...item,
                name: formData.name,
                price: Number.parseFloat(formData.price).toFixed(2),
                category: formData.category,
                description: formData.description,
              }
            : item,
        ),
      );
      onNotify("Plato actualizado", `Los cambios en "${formData.name}" han sido guardados.`);
    } else {
      const newDish: MenuItem = {
        id: Date.now(),
        name: formData.name,
        price: Number.parseFloat(formData.price).toFixed(2),
        category: formData.category,
        description: formData.description,
        image:
          "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
        status: "Activo",
      };
      setMenuItems([newDish, ...menuItems]);
      onNotify("Nuevo plato añadido", `El plato "${formData.name}" se publicó en tu carta digital.`);
    }
    setIsModalOpen(false);
    setFormData({ id: null, name: "", price: "", category: "", description: "" });
  };

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-section font-medium text-ink-900">Gestión de Carta</h2>
          <p className="text-nav text-ink-400">Añade, edita o elimina platos de tu menú.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="secondary"
            onClick={onPreview}
            className="border-ink-900/20 hover:border-ink-900"
          >
            Ver vista previa
          </Button>
          <Button
            onClick={() => {
              setFormData({ id: null, name: "", price: "", category: "", description: "" });
              setIsModalOpen(true);
            }}
            className="justify-center gap-2"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            Añadir Plato
          </Button>
        </div>
      </div>

      <TableCard>
        <THead>
          <tr>
            <TH>Nombre del Plato</TH>
            <TH>Categoría</TH>
            <TH>Precio</TH>
            <TH>Estado</TH>
            <TH right>Acciones</TH>
          </tr>
        </THead>
        <tbody>
          {menuItems.map((item) => (
            <TR key={item.id} className="hover:bg-primary-hover/[0.02] transition-colors">
              <TD tone="strong">{item.name}</TD>
              <TD>
                <span className="bg-primary/[0.05] px-2.5 py-1 rounded-md text-xs font-medium text-ink-600">{item.category}</span>
              </TD>
              <TD tone="strong">${item.price}</TD>
              <TD>
                <span className="flex items-center gap-1.5 text-ink-900 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-primary" /> {item.status}
                </span>
              </TD>
                  <TD right nowrap>
                    <RowActions
                      onEdit={() => {
                        setFormData({
                          id: item.id,
                          name: item.name,
                          price: item.price,
                          category: item.category,
                          description: item.description ?? "",
                        });
                        setIsModalOpen(true);
                      }}
                      onDelete={() => setMenuItems(menuItems.filter((m) => m.id !== item.id))}
                    />
                  </TD>
            </TR>
          ))}
        </tbody>
      </TableCard>

      {isModalOpen && (
        <Modal
          onClose={() => setIsModalOpen(false)}
          title={formData.id ? "Editar Plato" : "Nuevo Plato"}
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formData.name || !formData.price || !formData.category}
              >
                Guardar Plato
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Field label="Nombre">
                <TextInput
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Lomo Saltado"
                />
              </Field>
            </div>
            <div>
              <Field label="Precio ($)">
                <TextInput
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
              </Field>
            </div>
          </div>
          <div className="mt-4">
            <Field label="Categoría">
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="">Selecciona una categoría</option>
                <option value="Entradas">Entradas</option>
                <option value="Fondos">Fondos</option>
                <option value="Postres">Postres</option>
                <option value="Bebidas">Bebidas</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Descripción corta">
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Ingredientes principales o descripción atractiva..."
              />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
