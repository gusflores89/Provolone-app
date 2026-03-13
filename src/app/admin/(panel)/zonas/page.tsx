import { RebalanceZonesForm } from "@/components/admin/rebalance-zones-form";
import { ZoneAssignmentForm } from "@/components/admin/zone-assignment-form";
import { SectionCard } from "@/components/shared/section-card";
import { getAdminVendors, getAdminZones } from "@/lib/admin-live-data";

export default async function AdminZonesPage() {
  const [zonesData, vendorsData] = await Promise.all([getAdminZones(), getAdminVendors()]);

  const vendorOptions = vendorsData.rows.map((row) => ({
    id: row.id,
    vendorCode: row.vendorCode,
    fullName: row.fullName,
  }));

  const overloaded = zonesData.rows.filter((row) => row.status === "Sobrecarga").length;
  const unassigned = zonesData.rows.filter((row) => !row.vendorId).length;

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Zonas</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Carga por zona</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Reasigna zonas completas para redistribuir clientes y visitas futuras entre vendedores.
          </p>
        </div>

        <div className="w-full max-w-sm xl:justify-self-end">
          <RebalanceZonesForm disabled={!zonesData.connected || vendorOptions.length === 0} />
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard title="Zonas cargadas" subtitle="Total activas en Supabase.">
          <p className="text-3xl font-semibold text-[var(--foreground)]">{zonesData.rows.length}</p>
        </SectionCard>
        <SectionCard title="Sobrecargadas" subtitle="Superan el objetivo semanal configurado.">
          <p className="text-3xl font-semibold text-[var(--foreground)]">{overloaded}</p>
        </SectionCard>
        <SectionCard title="Sin vendedor" subtitle="Necesitan asignacion manual o rebalanceo.">
          <p className="text-3xl font-semibold text-[var(--foreground)]">{unassigned}</p>
        </SectionCard>
      </div>

      <SectionCard
        title="Zonas activas"
        subtitle={
          zonesData.connected
            ? `Mostrando ${zonesData.rows.length} zonas cargadas desde Supabase.`
            : zonesData.errorMessage ?? "No se pudieron cargar zonas."
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--muted-foreground)]">
              <tr>
                {["Zona", "Nombre", "Vendedor", "Clientes", "Objetivo", "Estado", "Reasignar"].map((head) => (
                  <th key={head} className="px-3 py-2 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zonesData.rows.length === 0 ? (
                <tr className="border-t border-[var(--border)]">
                  <td colSpan={7} className="px-3 py-4 text-[var(--muted-foreground)]">
                    No hay zonas para mostrar.
                  </td>
                </tr>
              ) : (
                zonesData.rows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--border)] align-top">
                    <td className="px-3 py-3">{row.zoneCode}</td>
                    <td className="px-3 py-3">{row.zoneName}</td>
                    <td className="px-3 py-3">{row.vendorCode}</td>
                    <td className="px-3 py-3">{row.customerCount}</td>
                    <td className="px-3 py-3">{row.weeklyTarget}</td>
                    <td className="px-3 py-3">{row.status}</td>
                    <td className="px-3 py-3">
                      <ZoneAssignmentForm
                        zoneId={row.id}
                        currentVendorId={row.vendorId}
                        vendors={vendorOptions}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </main>
  );
}
