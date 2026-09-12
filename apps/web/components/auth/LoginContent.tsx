"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/fields";
import { ROLE_HOME, ROLE_LABEL, demoUsers } from "@/lib/auth";
import { useModules } from "@/components/dashboard/ModulesProvider";

export function LoginContent() {
  const [loginError, setLoginError] = useState<string | null>(null);
  const router = useRouter();
  const { login } = useModules();

  const enterAs = (email: string) => {
    const user = login(email);
    if (!user) {
      setLoginError("Ese correo no coincide con ninguna cuenta demo.");
      return;
    }
    setLoginError(null);
    router.push(ROLE_HOME[user.role]);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    enterAs(email);
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
        <h1 className="text-section font-medium text-ink-900 mb-2 text-center">
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

          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>

        <div className="mt-6">
          <p className="text-xs text-ink-400 text-center mb-2">Cuentas demo por rol</p>
          <div className="flex flex-wrap justify-center gap-2">
            {demoUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => enterAs(u.email)}
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
