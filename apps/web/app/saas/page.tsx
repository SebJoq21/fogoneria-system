import { SaasPage } from "@/features/saas";
import { BillingSummary } from "@/features/billing";

/**
 * Consola SaaS del superadmin. La vista vive en `features/saas` y la sección de
 * facturación en `features/billing`; la ruta solo las compone para conservar el
 * layout raíz y el guard de `proxy.ts`.
 */
export default function SaasRoute() {
  return <SaasPage billing={<BillingSummary />} />;
}
