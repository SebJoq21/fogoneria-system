"use client";

import { useState } from "react";
import { TableCard, THead, TH, TR, TD, EmptyRow } from "@/components/ui/data-table";
import { Card } from "@/components/ui/Card";
import type { Payment } from "@/lib/dashboard";

const weekDays = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

export function PaymentsView({ paymentHistory }: { paymentHistory: Payment[] }) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const today = new Date();
  const monthName = today.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const daysInMonth = Array.from(
    { length: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() },
    (_, i) => i + 1,
  );
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const emptyStart = Array.from({ length: firstDay });

  const displayed = selectedDay
    ? paymentHistory.filter((p) => p.day === selectedDay)
    : paymentHistory;

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="flex flex-col justify-between">
          <p className="text-xs font-medium text-ink-400 mb-2 uppercase">Deuda actual</p>
          <p className="text-display font-medium text-ink-900 mb-2">$0.00</p>
          <span className="inline-flex w-max items-center gap-1.5 bg-primary text-white text-xs font-medium px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-surface rounded-full animate-pulse" />
            Todo al día
          </span>
        </Card>
        <Card className="flex flex-col h-full">
          <span className="text-xs font-medium text-ink-400 uppercase mb-2">
            Próximo pago
          </span>
          <h3 className="text-sm font-medium text-ink-900 mb-1">1 de Noviembre, 2026</h3>
          <p className="text-display font-medium text-ink-900 mb-6">$70.00</p>
          <div className="mt-auto">
            <button type="button" disabled className="w-full bg-primary/[0.05] text-ink-400 text-sm font-medium h-10 rounded-full cursor-not-allowed border border-ink-900/10">
              Pagar ahora
            </button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 h-max">
          <div className="flex justify-between items-center mb-4">
            <span className="p-2 text-ink-400">‹</span>
            <h3 className="font-medium text-sm text-ink-900">{formattedMonth}</h3>
            <span className="p-2 text-ink-400">›</span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-xs font-medium text-ink-400 py-1">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-sm">
            {emptyStart.map((_, i) => (
              <div key={`empty-${i}`} className="p-2" />
            ))}
            {daysInMonth.map((day) => {
              const events = paymentHistory.filter((p) => p.day === day);
              const isSelected = selectedDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`relative p-2 flex flex-col items-center justify-center rounded-lg transition-all text-nav cursor-pointer ${
                    isSelected ? "bg-primary text-white" : "hover:bg-primary-hover/[0.05] text-ink-600"
                  }`}
                >
                  <span className="font-medium z-10">{day}</span>
                  {events.length > 0 && (
                    <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-surface" : "bg-primary"}`} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-ink-900/[0.06] flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-ink-600">
              <span className="w-2 h-2 rounded-full bg-primary" /> Pagos de suscripción
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-600">
              <span className="w-2 h-2 rounded-full bg-ink-400" /> Compra de módulos
            </div>
          </div>
        </Card>

        <TableCard
          className="lg:col-span-2 flex flex-col"
          header={
            <>
              <h2 className="font-medium text-sm text-ink-900 flex-1">
                {selectedDay ? `Movimientos del ${selectedDay}` : "Historial de Movimientos"}
              </h2>
              {selectedDay && (
                <button onClick={() => setSelectedDay(null)} className="text-xs text-ink-900 font-medium hover:underline cursor-pointer">
                  Ver todos
                </button>
              )}
            </>
          }
        >

          <THead>
            <tr>
              <TH>Fecha</TH>
              <TH>Concepto</TH>
              <TH>Monto</TH>
              <TH>Estado</TH>
            </tr>
          </THead>
          <tbody>
            {displayed.length === 0 ? (
              <EmptyRow colSpan={4}>
                No hay movimientos registrados en esta fecha.
              </EmptyRow>
            ) : (
              displayed.map((payment) => (
                <TR key={payment.id} className="hover:bg-primary-hover/[0.02] transition-colors">
                  <TD tone="muted" nowrap>
                    <span className="text-nav">{payment.date}</span>
                  </TD>
                  <TD tone="strong">{payment.concept}</TD>
                  <TD tone="strong" nowrap>
                    {payment.amount}
                  </TD>
                  <TD nowrap>
                    <span className="bg-primary text-white px-2.5 py-1 rounded-full text-xs font-medium w-max">
                      {payment.status}
                    </span>
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </TableCard>
      </div>
    </div>
  );
}
