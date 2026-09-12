"use client";

import { useState } from "react";
import { PaymentsView } from "@/components/dashboard/PaymentsView";
import { PlanModal, SecurityModal } from "@/components/dashboard/PlanModals";
import { Button } from "@/components/ui/Button";
import { useModules } from "@/components/dashboard/ModulesProvider";

export default function PagosPage() {
  const { payments, notify } = useModules();
  const [planOpen, setPlanOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [activePlan, setActivePlan] = useState("profesional");
  const [selectedPlan, setSelectedPlan] = useState("profesional");
  const [authStep, setAuthStep] = useState(1);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-section font-medium text-ink-900">Gestión de pagos</h2>
          <p className="text-sm text-ink-400 mt-1">
            Plan {activePlan === "basico" ? "Básico" : "Profesional"} · Facturación mensual.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setPlanOpen(true)}
          className="border-ink-900/20 hover:border-ink-900 w-max"
        >
          Gestionar suscripción
        </Button>
      </div>

      <PaymentsView paymentHistory={payments} />

      {planOpen && (
        <PlanModal
          currentPlan={activePlan}
          selectedPlan={selectedPlan}
          setSelectedPlan={setSelectedPlan}
          onContinue={() => {
            setPlanOpen(false);
            setSecurityOpen(true);
            setAuthStep(1);
          }}
          onClose={() => setPlanOpen(false)}
        />
      )}
      {securityOpen && (
        <SecurityModal
          authStep={authStep}
          setAuthStep={setAuthStep}
          selectedPlan={selectedPlan}
          onConfirmPlanChange={() => {
            setActivePlan(selectedPlan);
            notify(
              "Plan actualizado con éxito",
              `Has cambiado al Plan ${selectedPlan === "basico" ? "Básico" : "Profesional"}.`,
            );
            setSecurityOpen(false);
            setPlanOpen(false);
            setAuthStep(1);
          }}
          onClose={() => {
            setSecurityOpen(false);
            setAuthStep(1);
          }}
        />
      )}
    </div>
  );
}
