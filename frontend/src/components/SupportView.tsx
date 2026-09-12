import React, { useState } from 'react';

function SupportBadge({ status }) {
  const styles = {
    'Enviado': 'bg-blue-50 text-blue-600',
    'En proceso': 'bg-amber-50 text-amber-600',
    'Aceptado': 'bg-emerald-50 text-emerald-600',
    'Rechazado': 'bg-red-50 text-red-600',
    'Resuelto': 'bg-emerald-50 text-emerald-600'
  };
  const badgeStyle = styles[status] || 'bg-slate-100 text-slate-600';

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeStyle}`}>
      {status}
    </span>
  );
}

export default function SupportView({ tickets, setTickets, onNotify }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '' });

  const handleCreateTicket = () => {
    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
      alert("Por favor completa el asunto y la descripción del problema.");
      return;
    }

    const newTicket = {
      id: `#TK-${Math.floor(Math.random() * 9000) + 1000}`,
      subject: ticketForm.subject,
      status: 'Enviado',
      updated: 'Justo ahora'
    };

    setTickets([newTicket, ...tickets]);
    onNotify('Ticket enviado', `Tu solicitud "${newTicket.subject}" ha sido enviada a soporte.`);

    setIsModalOpen(false);
    setTicketForm({ subject: '', description: '' });
  };

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold text-slate-900">
          Centro de Ayuda y Tickets
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          Crear nuevo ticket
        </button>
      </div>

      {/* Tabla de Tickets */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-medium">ID Ticket</th>
                <th className="px-6 py-4 font-medium">Asunto</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium">Última actualización</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">No tienes tickets de soporte activos.</td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-indigo-600">{ticket.id}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{ticket.subject}</td>
                    <td className="px-6 py-4"><SupportBadge status={ticket.status} /></td>
                    <td className="px-6 py-4 text-slate-500">{ticket.updated}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Nuevo Ticket */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden animate-[scaleUp_0.2s_ease-out] flex flex-col" onClick={(e) => e.stopPropagation()}>

            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Crear Ticket de Soporte</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Asunto</label>
                <input
                  type="text"
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm({...ticketForm, subject: e.target.value})}
                  placeholder="Ej. Problema con mis reservas"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción detallada</label>
                <textarea
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({...ticketForm, description: e.target.value})}
                  rows="4"
                  placeholder="Explica qué está sucediendo para que nuestro equipo pueda ayudarte..."
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"
                ></textarea>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                Cancelar
              </button>
              <button onClick={handleCreateTicket} className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">
                Enviar Ticket
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}