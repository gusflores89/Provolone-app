import { SectionCard } from "@/components/shared/section-card";
import { vendorLogoutAction } from "@/app/vendedor/actions";
import { getVendorSession } from "@/lib/vendor-session";

export default async function VendorProfilePage() {
  const session = await getVendorSession();

  return (
    <main className="space-y-5 pb-24 pt-2">
      <SectionCard title={session?.vendorName ?? "Vendedor"} subtitle={`Codigo ${session?.vendorCode ?? "-"}`}>
        <div className="space-y-4 text-sm">
          <div className="rounded-2xl bg-[var(--surface-alt)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Sesion</p>
            <p className="mt-2 text-base font-semibold">Activa en este telefono</p>
          </div>
          <form action={vendorLogoutAction}>
            <button className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-4 text-sm font-semibold">
              Cerrar sesion
            </button>
          </form>
        </div>
      </SectionCard>
    </main>
  );
}
