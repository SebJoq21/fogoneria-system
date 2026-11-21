"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/fields";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/support";

/**
 * Recuperación de contraseña por soporte.
 *
 * No existe endpoint de reset ni envío automático de correo: el formulario solo
 * abre el cliente de correo con el mensaje prellenado. La copia debe seguir
 * siendo honesta con ese flujo.
 */
export function RecoverPage() {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    window.location.href = supportMailto({ email: email || undefined });
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
          Recuperar contraseña
        </h1>
        <p className="text-sm text-ink-600 text-center mb-6">
          El restablecimiento lo gestiona nuestro equipo de soporte. Cuéntanos el correo de tu
          cuenta y te ayudamos a recuperar el acceso.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <Field
              label="Correo Electrónico"
              htmlFor="email"
              hint="Opcional: si lo dejas vacío, igual abriremos el mensaje."
            >
              <TextInput
                id="email"
                name="email"
                type="email"
                placeholder="tucorreo@ejemplo.com"
                className="focus:ring-primary/20 transition-colors"
              />
            </Field>
          </div>

          <Button type="submit" className="w-full">
            Solicitar ayuda
          </Button>
        </form>

        <p className="text-nav text-ink-600 text-center mt-6">
          ¿Prefieres escribirnos directo?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-ink-900 font-medium hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>

        <p className="text-nav text-ink-600 text-center mt-4">
          <Link href="/" className="hover:text-ink-900 hover:underline">
            Volver a iniciar sesión
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
