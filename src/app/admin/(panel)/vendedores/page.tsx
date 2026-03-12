import { SectionCard } from "@/components/shared/section-card";
import { getAdminVendors } from "@/lib/admin-live-data";

export default async function AdminVendorsPage() {
  const data = await getAdminVendors();

  return (
    <main className="space-y-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Vendedores</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Equipo de ventas</h1>
      </header>

      <SectionCard
        title="Listado"
        subtitle={
          data.connected
            ? `Mostrando ${data.rows.length} vendedores cargados desde Supabase.`
            : data.errorMessage ?? "No se pudieron cargar vendedores."
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--muted-foreground)]">
              <tr>
                {['Codigo','Nombre','Zonas','Clientes','Estado'].map((head) => (
                  <th key={head} className="px-3 py-2 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr className="border-t border-[var(--border)]">
                  <td colSpan={5} className="px-3 py-4 text-[var(--muted-foreground)]">
                    No hay vendedores para mostrar.
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-3">{row.vendorCode}</td>
                    <td className="px-3 py-3">{row.fullName}</td>
                    <td className="px-3 py-3">{row.zoneCount}</td>
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
