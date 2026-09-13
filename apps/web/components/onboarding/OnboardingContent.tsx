"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { DropZone } from "@/components/onboarding/DropZone";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/fields";

const steps = ["Identidad y Local", "La Carta", "Pago y Activación"];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center w-full max-w-2xl mb-10 px-4 sm:px-10">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = current === stepNumber;
        const isDone = current > stepNumber;

        return (
          <Fragment key={step}>
            <div className="relative flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium z-10 transition-colors ${
                  isDone
                    ? "bg-primary text-white"
                    : isActive
                      ? "bg-primary text-white"
                      : "bg-primary/10 text-ink-400"
                }`}
              >
                {isDone ? <Check size={14} /> : stepNumber}
              </div>
              <span
                className={`absolute top-12 text-center text-xs font-medium w-32 ${
                  isActive || isDone ? "text-ink-900" : "text-ink-400"
                }`}
              >
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 rounded ${
                  current > index + 1 ? "bg-primary" : "bg-primary/10"
                }`}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function StepIdentity() {
  return (
    <div>
      <h2 className="text-display font-medium text-ink-900 mb-4">
        Conozcamos tu restaurante
      </h2>
      <Field label="Historia o Quiénes Somos" htmlFor="story">
        <Textarea id="story" rows={2} className="mb-4" />
      </Field>
      <span className="text-nav font-medium text-ink-600 mb-2 block">
        Sube fotos de tu local y tu equipo
      </span>
      <DropZone type="images" text="Haz clic o arrastra tus imágenes aquí" />
    </div>
  );
}

function StepMenu() {
  return (
    <div>
      <h2 className="text-display font-medium text-ink-900 mb-2">
        Tu catálogo de sabores
      </h2>
      <p className="text-sm text-ink-600 mb-4">
        Sube tu carta en formato PDF o fotos claras de tus menús.
      </p>
      <DropZone type="document" text="Haz clic o arrastra tu carta aquí" />
    </div>
  );
}

function StepPayment() {
  return (
    <div>
      <h2 className="text-display font-medium text-ink-900 mb-2">
        Último paso: Activa tu web
      </h2>
      <p className="text-sm text-ink-600 mb-4">
        Sube la captura de tu transferencia o pago por billetera digital para
        que nuestro equipo ensamble tu sitio inmediatamente.
      </p>
      <DropZone type="payment" text="Haz clic o arrastra tu comprobante aquí" />
    </div>
  );
}

export function OnboardingContent() {
  const [step, setStep] = useState(1);
  const router = useRouter();

  const handleNext = () => {
    if (step === steps.length) {
      router.push("/app");
      return;
    }
    setStep((prev) => Math.min(prev + 1, steps.length));
  };
  const handleBack = () => setStep((prev) => Math.max(prev - 1, 1));

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-surface py-6 px-4">
      <Link
        href="/"
        className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center text-ink-600 hover:text-ink-900 transition-colors text-nav font-medium px-2 py-2"
      >
        ← Volver al login
      </Link>

      <Link href="/" className="mb-6 hover:opacity-80 transition-opacity">
        <span className="flex items-center gap-2 text-sm font-medium text-ink-900">
          Fogonería
        </span>
      </Link>

      <div className="w-full max-w-2xl flex flex-col">
        <Stepper current={step} />

        <div className="w-full bg-surface p-4 rounded-2xl border border-ink-900/10">
          {step === 1 && <StepIdentity />}
          {step === 2 && <StepMenu />}
          {step === 3 && <StepPayment />}

          <div className="flex items-center justify-between mt-6">
            {step === 1 ? (
              <Link
                href="/"
                className="text-ink-400 hover:text-ink-900 font-medium text-sm px-4 h-10 inline-flex items-center transition-colors"
              >
                Cancelar
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleBack}
                className="text-ink-600 hover:text-ink-900 font-medium text-sm px-4 h-10 transition-colors cursor-pointer"
              >
                ← Atrás
              </button>
            )}
            <Button type="button" onClick={handleNext}>
              {step === steps.length ? "Finalizar y Enviar" : "Siguiente"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
