import type { Metadata } from "next";
import { RecoverPage } from "@/features/auth";

export const metadata: Metadata = {
  title: "Recuperar contraseña — Fogonería",
};

export default function RecuperarRoute() {
  return <RecoverPage />;
}
