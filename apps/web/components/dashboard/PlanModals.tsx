"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/fields";

export function PlanModal({
  onClose,
  onContinue,
  currentPlan,
  selectedPlan,
  setSelectedPlan,
}: {
  onClose: () => void;
  onContinue: () => void;
  currentPlan: string;
  selectedPlan: string;
  setSelectedPlan: (p: string) => void;
}) {
  const plans = [
    { id: "basico", name: "Plan Básico", price: "$40", desc: "Carta digital QR sin sitio web completo. Ideal para locales pequeños." },
    { id: "profesional", name: "Plan Profesional", price: "$70", desc: "Landing page completa, dominio propio y gestión por nuestro equipo." },
  ];

  return (
    <Modal
      onClose={onClose}
      title="Gestiona tu suscripción"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={selectedPlan === currentPlan}
            onClick={onContinue}
            className="w-full sm:w-auto"
          >
            {selectedPlan === currentPlan ? "Plan Actual" : "Continuar"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-600 mb-6">
        Selecciona el plan que mejor se adapte a las necesidades actuales de tu restaurante.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => setSelectedPlan(plan.id)}
            className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              selectedPlan === plan.id ? "border-ink-900" : "border-ink-900/10 hover:border-ink-900/30"
            }`}
          >
            {currentPlan === plan.id && (
              <span className="absolute -top-3 left-4 bg-primary text-white text-xs font-medium px-3 py-1 rounded-full uppercase">
                Plan Actual
              </span>
            )}
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium text-sm text-ink-900">{plan.name}</h4>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPlan === plan.id ? "border-ink-900" : "border-ink-900/20"}`}>
                {selectedPlan === plan.id && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
              </div>
            </div>
            <div className="mb-3">
              <span className="text-section font-medium text-ink-900">{plan.price}</span>
              <span className="text-nav text-ink-400">/mes</span>
            </div>
            <p className="text-sm text-ink-600">{plan.desc}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function SecurityModal({
  authStep,
  setAuthStep,
  selectedPlan,
  onConfirmPlanChange,
  onClose,
}: {
  authStep: number;
  setAuthStep: (n: number) => void;
  selectedPlan: string;
  onConfirmPlanChange: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      onClose={onClose}
      title="Verificación de Seguridad"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {authStep === 1 ? (
            <Button onClick={() => setAuthStep(2)}>
              Verificar contraseña
            </Button>
          ) : (
            <Button onClick={onConfirmPlanChange}>
              Autorizar y Cambiar Plan
            </Button>
          )}
        </>
      }
    >
      <div className="bg-primary/[0.04] border border-ink-900/10 text-ink-600 text-sm p-4 rounded-2xl mb-6">
        Cambiar al <strong className="text-ink-900">Plan {selectedPlan === "basico" ? "Básico" : "Profesional"}</strong>. Valida tu identidad para autorizar el cambio.
      </div>

      {authStep === 1 ? (
        <Field label="Contraseña de administrador">
          <TextInput
            type="password"
            placeholder="Ingresa tu contraseña para continuar"
          />
        </Field>
      ) : (
        <div>
          <Field label="Código de verificación">
            <TextInput
              variant="code"
              type="text"
              placeholder="0 0 0 0 0 0"
              maxLength={6}
            />
          </Field>
          <p className="text-xs text-ink-400 mt-2">Te enviamos un código de 6 dígitos al correo de la empresa.</p>
        </div>
      )}
    </Modal>
  );
}
