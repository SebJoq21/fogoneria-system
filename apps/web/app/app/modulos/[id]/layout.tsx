import { ModuleGuard } from "@/components/dashboard/ModuleGate";

export default function ModuleLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard>{children}</ModuleGuard>;
}
