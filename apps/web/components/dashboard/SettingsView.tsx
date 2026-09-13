"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/fields";

export function SettingsView({
  onNotify,
}: {
  onNotify: (title: string, message: string) => void;
}) {
  const [business, setBusiness] = useState({
    tradeName: "Mi Restaurante S.A.C.",
    legalName: "MI RESTAURANTE SOCIEDAD ANONIMA CERRADA",
    taxId: "20123456789",
    phone: "+51 987 654 321",
    address: "Av. Principal 123, Lima",
  });
  const [security, setSecurity] = useState({ email: "admin@mirestaurante.com", currentPassword: "", newPassword: "" });
  const [step, setStep] = useState(1);

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-[fadeIn_0.3s_ease-out]">
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-4 border-b border-ink-900/[0.06] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <h2 className="text-sm font-medium text-ink-900">Información del Restaurante</h2>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onNotify("Datos actualizados", "La información de tu restaurante se ha guardado correctamente.");
          }}
          className="p-4"
        >
          <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="w-24 h-24 rounded-2xl bg-primary/[0.04] border-2 border-dashed border-ink-900/15 flex items-center justify-center text-ink-900">
                <span className="font-medium text-display">MR</span>
              </div>
              <span className="text-xs text-ink-900 font-medium cursor-pointer hover:underline">Cambiar logo</span>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <div className="sm:col-span-2">
                <Field label="Nombre Comercial">
                  <TextInput type="text" value={business.tradeName} onChange={(e) => setBusiness({ ...business, tradeName: e.target.value })} />
                </Field>
              </div>
              <div>
                <Field label="Razón Social">
                  <TextInput type="text" value={business.legalName} onChange={(e) => setBusiness({ ...business, legalName: e.target.value })} />
                </Field>
              </div>
              <div>
                <Field label="RUC / NIT">
                  <TextInput type="text" value={business.taxId} onChange={(e) => setBusiness({ ...business, taxId: e.target.value })} />
                </Field>
              </div>
              <div>
                <Field label="Teléfono">
                  <TextInput type="text" value={business.phone} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Dirección del Local">
                  <TextInput type="text" value={business.address} onChange={(e) => setBusiness({ ...business, address: e.target.value })} />
                </Field>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-ink-900/[0.06]">
            <Button type="submit">
              Guardar Información
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-4 border-b border-ink-900/[0.06] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/[0.06] text-ink-600 flex items-center justify-center">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h2 className="text-sm font-medium text-ink-900">Seguridad y Acceso</h2>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 1) {
              if (security.newPassword && !security.currentPassword) return;
              setStep(2);
            } else {
              onNotify("Seguridad actualizada", "Tus credenciales de acceso han sido modificadas exitosamente.");
              setSecurity({ ...security, currentPassword: "", newPassword: "" });
              setStep(1);
            }
          }}
          className="p-4"
        >
          {step === 1 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="sm:col-span-2">
                <Field
                  label="Correo de Administración"
                  hint="Se usa para facturación y recuperación de contraseña."
                >
                  <TextInput type="email" value={security.email} onChange={(e) => setSecurity({ ...security, email: e.target.value })} />
                </Field>
              </div>
              <div>
                <Field label="Contraseña Actual">
                  <TextInput type="password" placeholder="••••••••" value={security.currentPassword} onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })} />
                </Field>
              </div>
              <div>
                <Field label="Nueva Contraseña">
                  <TextInput type="password" placeholder="Mínimo 8 caracteres" value={security.newPassword} onChange={(e) => setSecurity({ ...security, newPassword: e.target.value })} />
                </Field>
              </div>
            </div>
          ) : (
            <div className="mb-6 max-w-sm">
              <Field label="Código de verificación">
                <p className="text-xs text-ink-400 mb-3">
                  Te enviamos un código de 6 dígitos al correo <strong>{security.email}</strong>.
                </p>
                <TextInput
                  variant="code"
                  type="text"
                  placeholder="0 0 0 0 0 0"
                  maxLength={6}
                  required
                />
              </Field>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-ink-900/[0.06] gap-2">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 h-10 bg-primary/[0.05] text-ink-600 text-sm font-medium rounded-full hover:bg-primary-hover/10 cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <Button type="submit">
              {step === 1 ? "Actualizar Seguridad" : "Verificar y Guardar"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
