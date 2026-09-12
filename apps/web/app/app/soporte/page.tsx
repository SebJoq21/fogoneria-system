"use client";

import { SupportView } from "@/components/dashboard/SupportView";
import { useModules } from "@/components/dashboard/ModulesProvider";

export default function SoportePage() {
  const { tickets, setTickets, notify } = useModules();
  return <SupportView tickets={tickets} setTickets={setTickets} onNotify={notify} />;
}
