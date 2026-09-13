"use client";

import { useState } from "react";
import { TableCard, THead, TH, TR, TD, EmptyRow } from "@/components/ui/data-table";
import { Button } from "@/components/ui/Button";
import { Field, TextInput, Textarea } from "@/components/ui/fields";
import { Modal } from "@/components/ui/Modal";
import type { Ticket } from "@/lib/dashboard";

function SupportBadge({ status }: { status: string }) {
  return (
    <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/[0.05] text-ink-600">
      {status}
    </span>
  );
}

export function SupportView({
  tickets,
  setTickets,
  onNotify,
}: {
  tickets: Ticket[];
  setTickets: (t: Ticket[]) => void;
  onNotify: (title: string, message: string) => void;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "" });

  const handleCreate = () => {
    if (!form.subject.trim() || !form.description.trim()) return;
    const newTicket: Ticket = {
      id: `#TK-${Math.floor(Math.random() * 9000) + 1000}`,
      subject: form.subject,
      status: "Enviado",
      updated: "Justo ahora",
    };
    setTickets([newTicket, ...tickets]);
    onNotify("Ticket enviado", `Tu solicitud "${newTicket.subject}" ha sido enviada a soporte.`);
    setIsModalOpen(false);
    setForm({ subject: "", description: "" });
  };

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h2 className="text-display font-medium text-ink-900">Centro de Ayuda y Tickets</h2>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          Crear nuevo ticket
        </Button>
      </div>

      <TableCard>
        <THead>
          <tr>
            <TH>ID Ticket</TH>
            <TH>Asunto</TH>
            <TH>Estado</TH>
            <TH>Última actualización</TH>
          </tr>
        </THead>
        <tbody>
          {tickets.length === 0 ? (
            <EmptyRow colSpan={4}>No tienes tickets de soporte activos.</EmptyRow>
          ) : (
            tickets.map((ticket) => (
              <TR key={ticket.id} className="hover:bg-primary-hover/[0.02] transition-colors">
                <TD tone="strong">{ticket.id}</TD>
                <TD tone="strong">{ticket.subject}</TD>
                <TD>
                  <SupportBadge status={ticket.status} />
                </TD>
                <TD tone="muted">
                  <span className="text-nav">{ticket.updated}</span>
                </TD>
              </TR>
            ))
          )}
        </tbody>
      </TableCard>

      {isModalOpen && (
        <Modal
          onClose={() => setIsModalOpen(false)}
          title="Crear Ticket de Soporte"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!form.subject.trim() || !form.description.trim()}
              >
                Enviar Ticket
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Asunto">
              <TextInput
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Ej. Problema con mis reservas"
              />
            </Field>
            <Field label="Descripción detallada">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                placeholder="Explica qué está sucediendo para que nuestro equipo pueda ayudarte..."
              />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
