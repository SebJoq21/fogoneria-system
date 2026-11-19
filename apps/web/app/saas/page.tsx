import { SaasPage } from "@/features/plataforma";

/**
 * Consola SaaS del superadmin. La vista vive en `features/plataforma`; la ruta
 * solo la monta para conservar el layout raíz y el guard de `proxy.ts`.
 */
export default function SaasRoute() {
  return <SaasPage />;
}
