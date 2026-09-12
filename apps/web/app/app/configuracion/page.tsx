"use client";

import { SettingsView } from "@/components/dashboard/SettingsView";
import { useModules } from "@/components/dashboard/ModulesProvider";

export default function ConfiguracionPage() {
  const { notify } = useModules();
  return <SettingsView onNotify={notify} />;
}
