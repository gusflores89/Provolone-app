import { redirect } from "next/navigation";
import { VendorLoginForm } from "@/components/vendor/vendor-login-form";
import { getVendorSession } from "@/lib/vendor-session";

export default async function VendorLoginPage() {
  const session = await getVendorSession();

  if (session) {
    redirect("/vendedor/hoy");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-[32px] border border-[var(--border)] bg-white px-6 py-8 shadow-[0_26px_70px_rgba(15,23,42,0.10)] sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--primary)]">
          Acceso vendedor
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Ingresar</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          Ingresa tu codigo de vendedor y PIN para ver tus clientes del dia.
        </p>

        <VendorLoginForm />
      </section>
    </main>
  );
}
