import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/ingresar");
  }

  return session;
}
