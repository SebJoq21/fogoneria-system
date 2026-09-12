import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginContent } from "@/components/auth/LoginContent";
import { ROLE_HOME, type AppRole } from "@/lib/auth";

export default async function Home() {
  const cookieStore = await cookies();
  const role = cookieStore.get("fogoneria.role")?.value as AppRole | undefined;

  if (role && ROLE_HOME[role]) {
    redirect(ROLE_HOME[role]);
  }

  return <LoginContent />;
}
