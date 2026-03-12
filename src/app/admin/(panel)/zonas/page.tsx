import { SectionCard } from "@/components/shared/section-card";
import { getAdminZones } from "@/lib/admin-live-data";

export default async function AdminZonesPage() {
  const data = await getAdminZones();

  return (
    <main className="space-y-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Zonas</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Carga por zona</h1>
      </header>

      <SectionCard
        title="Zonas activas"
        subtitle={
          data.connected
            ? `Mostrando ${data.rows.length} zonas cargadas desde Supabase.`
            : data.errorMessage ?? "No se pudieron cargar zonas."
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--muted-foreground)]">
              <tr>
                {['Zona','Nombre','Vendedor','Clientes','Estado'].map((head) => (
                  <th key={head} className="px-3 py-2 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr className="border-t border-[var(--border)]">
                  <td colSpan={5} className="px-3 py-4 text-[var(--muted-foreground)]">
                    No hay zonas para mostrar.
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-3">{row.zoneCode}</td>
                    <td className="px-3 py-3">{row.zoneName}</td>
                    <td className="px-3 py-3">{row.vendorCode}</td>
                    <td className="px-3 py-3">{row.customerCount}</td>
                    <td className="px-3 py-3">{row.status}</td>
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
