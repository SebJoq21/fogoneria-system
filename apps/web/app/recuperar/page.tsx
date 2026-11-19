import type { Metadata } from "next";
import { RecoverPage } from "@/features/plataforma";

export const metadata: Metadata = {
  title: "Recuperar contraseña — Fogonería",
};

export default function RecuperarRoute() {
  return <RecoverPage />;
}
