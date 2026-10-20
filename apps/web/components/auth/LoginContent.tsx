"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/fields";
import { ROLE_HOME, ROLE_LABEL, DEMO_PASSWORD, demoUsers } from "@/lib/auth";
import { useModules } from "@/components/dashboard/ModulesProvider";

export function LoginContent() {
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useModules();

  const enterAs = async (email: string, password: string) => {
    setLoading(true);
    setLoginError(null);
    try {
      const user = await login(email, password);
      router.push(ROLE_HOME[user.role]);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    if (!email.trim() || !password) {
      setLoginError("Ingresa tu correo y contraseña.");
      return;
    }
    void enterAs(email, password);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-surface px-4 py-6">
      <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity mb-6" aria-label="Fogonería">
        <span className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center">
          <Flame size={20} strokeWidth={2} />
        </span>
        <span className="text-sm font-medium text-ink-900">Fogonería</span>
      </Link>

      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-4 border border-ink-900/10">
        <h1 className="text-display font-medium text-ink-900 mb-2 text-center">
          Bienvenido de nuevo
        </h1>
        <p className="text-sm text-ink-600 text-center mb-6">
          Inicia sesión para gestionar tu restaurante.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-6 space-y-3">
            <Field label="Correo Electrónico" htmlFor="email">
              <TextInput
                id="email"
                name="email"
                type="email"
                placeholder="tucorreo@ejemplo.com"
                className="focus:ring-primary/20 transition-colors"
              />
            </Field>
            <Field label="Contraseña" htmlFor="password">
              <TextInput
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                className="focus:ring-primary/20 transition-colors"
              />
            </Field>
          </div>

          {loginError && (
            <p className="text-sm text-red-600 text-center mb-4">{loginError}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <div className="mt-6">
          <p className="text-xs text-ink-400 text-center mb-2">Cuentas demo por rol</p>
          <div className="flex flex-wrap justify-center gap-2">
            {demoUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => void enterAs(u.email, DEMO_PASSWORD)}
                className="px-3 h-10 rounded-full text-xs font-medium text-ink-600 border border-ink-900/15 hover:border-ink-900 hover:text-ink-900 transition-colors cursor-pointer"
              >
                {ROLE_LABEL[u.role]}
              </button>
            ))}
          </div>
        </div>

        <p className="text-nav text-ink-600 text-center mt-6">
          ¿No tienes cuenta?{" "}
          <Link href="/onboarding" className="text-ink-900 font-medium hover:underline">
            Regístrate
          </Link>
        </p>
      </div>

      <p className="text-xs text-ink-400 text-center mt-6">
        Al continuar aceptas los{" "}
        <Link href="/terminos" className="text-ink-900 font-medium hover:underline">
          Términos y Condiciones
        </Link>
        .
      </p>
    </main>
  );
}
