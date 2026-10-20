"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { DropZone } from "@/components/onboarding/DropZone";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput, Textarea } from "@/components/ui/fields";
import { useModules } from "@/components/dashboard/ModulesProvider";
import { ROLE_HOME } from "@/lib/auth";
import {
  isValidRuc,
  submitOnboarding,
  type RangoSucursales,
} from "@/lib/onboarding-api";

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

type Form = {
  nombreLegal: string;
  nombreComercial: string;
  ruc: string;
  logoUrl: string;
  sucursalNombre: string;
  telefono: string;
  rangoSucursales: RangoSucursales;
  story: string;
  nombreAdmin: string;
  emailAdmin: string;
  password: string;
  menuFileName: string;
  paymentFileName: string;
};

const emptyForm: Form = {
  nombreLegal: "",
  nombreComercial: "",
  ruc: "",
  logoUrl: "",
  sucursalNombre: "",
  telefono: "",
  rangoSucursales: "UNO",
  story: "",
  nombreAdmin: "",
  emailAdmin: "",
  password: "",
  menuFileName: "",
  paymentFileName: "",
};

export function OnboardingContent() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { login } = useModules();

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const readLogo = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("El logo debe ser una imagen (PNG, JPG o SVG).");
      return;
    }
    if (file.size > 2_000_000) {
      setError("El logo no puede pesar más de 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      set("logoUrl", String(reader.result ?? ""));
    };
    reader.readAsDataURL(file);
  };

  const validateStep = (): string | null => {
    if (step === 1) {
      if (!form.nombreLegal.trim()) return "Ingresa la razón social del negocio.";
      if (!isValidRuc(form.ruc)) return "El RUC debe tener 11 dígitos y ser válido.";
    }
    if (step === steps.length) {
      if (!form.nombreAdmin.trim()) return "Ingresa el nombre del administrador.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailAdmin.trim()))
        return "Ingresa un correo válido.";
      if (form.password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    }
    return null;
  };

  const finish = async () => {
    setSubmitting(true);
    setError(null);
    const notas = [
      form.story.trim() && `Historia: ${form.story.trim()}`,
      form.menuFileName && `Carta: ${form.menuFileName}`,
      form.paymentFileName && `Comprobante: ${form.paymentFileName}`,
    ]
      .filter(Boolean)
      .join(" · ");

    try {
      await submitOnboarding({
        nombreLegal: form.nombreLegal.trim(),
        nombreComercial: form.nombreComercial.trim() || undefined,
        ruc: form.ruc.trim(),
        logoUrl: form.logoUrl || undefined,
        sucursalNombre: form.sucursalNombre.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        rangoSucursales: form.rangoSucursales,
        nombreAdmin: form.nombreAdmin.trim(),
        emailAdmin: form.emailAdmin.trim(),
        password: form.password,
        notas: notas || undefined,
      });

      try {
        const user = await login(form.emailAdmin, form.password);
        router.push(ROLE_HOME[user.role]);
      } catch {
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el registro.");
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    if (step === steps.length) {
      void finish();
      return;
    }
    setStep((prev) => Math.min(prev + 1, steps.length));
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

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
          {step === 1 && (
            <div>
              <h2 className="text-display font-medium text-ink-900 mb-4">
                Conozcamos tu restaurante
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Razón social" htmlFor="legal">
                    <TextInput
                      id="legal"
                      value={form.nombreLegal}
                      onChange={(e) => set("nombreLegal", e.target.value)}
                      placeholder="Ej. Parrilla El Fuego S.A.C."
                    />
                  </Field>
                </div>
                <div>
                  <Field label="Nombre comercial" htmlFor="comercial">
                    <TextInput
                      id="comercial"
                      value={form.nombreComercial}
                      onChange={(e) => set("nombreComercial", e.target.value)}
                      placeholder="Ej. El Fuego"
                    />
                  </Field>
                </div>
                <div>
                  <Field label="RUC" htmlFor="ruc">
                    <TextInput
                      id="ruc"
                      value={form.ruc}
                      onChange={(e) => set("ruc", e.target.value.replace(/\D/g, "").slice(0, 11))}
                      placeholder="20123456786"
                      inputMode="numeric"
                      className="tnum"
                    />
                  </Field>
                </div>
                <div>
                  <Field label="Sucursal principal" htmlFor="sucursal">
                    <TextInput
                      id="sucursal"
                      value={form.sucursalNombre}
                      onChange={(e) => set("sucursalNombre", e.target.value)}
                      placeholder="Ej. Sede principal"
                    />
                  </Field>
                </div>
                <div>
                  <Field label="Teléfono" htmlFor="telefono">
                    <TextInput
                      id="telefono"
                      value={form.telefono}
                      onChange={(e) => set("telefono", e.target.value)}
                      placeholder="999 888 777"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Número de locales que operarás" htmlFor="rango">
                    <Select
                      id="rango"
                      value={form.rangoSucursales}
                      onChange={(e) => set("rangoSucursales", e.target.value as RangoSucursales)}
                    >
                      <option value="UNO">1 local</option>
                      <option value="DOS_A_TRES">2 a 3 locales</option>
                      <option value="CUATRO_O_MAS">4 o más locales</option>
                    </Select>
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Historia o Quiénes Somos" htmlFor="story">
                    <Textarea
                      id="story"
                      rows={2}
                      value={form.story}
                      onChange={(e) => set("story", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-nav font-medium text-ink-600 mb-2 block">
                    Logo del restaurante
                  </span>
                  <DropZone
                    type="images"
                    text="Haz clic o arrastra tu logo aquí"
                    fileName={form.logoUrl.startsWith("data:") ? "Logo cargado" : undefined}
                    onFile={readLogo}
                  />
                  <div className="mt-3">
                    <Field label="o pega la URL del logo" htmlFor="logo">
                      <TextInput
                        id="logo"
                        value={form.logoUrl.startsWith("data:") ? "" : form.logoUrl}
                        onChange={(e) => set("logoUrl", e.target.value)}
                        placeholder="https://…"
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-display font-medium text-ink-900 mb-2">
                Tu catálogo de sabores
              </h2>
              <p className="text-sm text-ink-600 mb-4">
                Sube tu carta en formato PDF o fotos claras de tus menús.
              </p>
              <DropZone
                type="document"
                text="Haz clic o arrastra tu carta aquí"
                fileName={form.menuFileName || undefined}
                onFile={(file) => set("menuFileName", file.name)}
              />
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-display font-medium text-ink-900 mb-2">
                Último paso: Activa tu web
              </h2>
              <p className="text-sm text-ink-600 mb-4">
                Sube la captura de tu transferencia o pago por billetera digital y crea
                la cuenta del administrador.
              </p>
              <DropZone
                type="payment"
                text="Haz clic o arrastra tu comprobante aquí"
                fileName={form.paymentFileName || undefined}
                onFile={(file) => set("paymentFileName", file.name)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="sm:col-span-2">
                  <Field label="Nombre del administrador" htmlFor="admin">
                    <TextInput
                      id="admin"
                      value={form.nombreAdmin}
                      onChange={(e) => set("nombreAdmin", e.target.value)}
                      placeholder="Ej. María Torres"
                    />
                  </Field>
                </div>
                <div>
                  <Field label="Correo" htmlFor="admin-email">
                    <TextInput
                      id="admin-email"
                      type="email"
                      value={form.emailAdmin}
                      onChange={(e) => set("emailAdmin", e.target.value)}
                      placeholder="admin@turestaurante.pe"
                    />
                  </Field>
                </div>
                <div>
                  <Field label="Contraseña" htmlFor="admin-password">
                    <TextInput
                      id="admin-password"
                      type="password"
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 mt-4" role="alert">
              {error}
            </p>
          )}

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
            <Button type="button" onClick={handleNext} disabled={submitting}>
              {submitting
                ? "Activando…"
                : step === steps.length
                  ? "Finalizar y Enviar"
                  : "Siguiente"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
