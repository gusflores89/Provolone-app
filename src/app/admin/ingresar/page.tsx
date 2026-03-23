import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getAdminSession } from "@/lib/admin-session";

export default async function AdminLoginPage() {
  const session = await getAdminSession();

  if (session) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-lg rounded-[32px] border border-[var(--border)] bg-white px-6 py-8 shadow-[0_26px_70px_rgba(15,23,42,0.10)] sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--primary)]">
          Acceso admin
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Panel operativo</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          Ingreso separado para administracion.
        </p>

        <AdminLoginForm />
      </section>
    </main>
  );
}
