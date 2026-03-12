import { CustomerAssignmentForm } from "@/components/admin/customer-assignment-form";
import { SectionCard } from "@/components/shared/section-card";
import { getAdminCustomers, getAdminVendors } from "@/lib/admin-live-data";

type SearchParams = Promise<{ q?: string; zone?: string; vendor?: string; active?: string }> | { q?: string; zone?: string; vendor?: string; active?: string };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = (await Promise.resolve(searchParams)) ?? {};
  const [customersData, vendorsData] = await Promise.all([getAdminCustomers(300), getAdminVendors()]);

  const vendorOptions = vendorsData.rows.map((row) => ({
    id: row.id,
    vendorCode: row.vendorCode,
    fullName: row.fullName,
  }));

  const zoneOptions = Array.from(new Set(customersData.rows.map((row) => row.zoneName))).sort((a, b) => a.localeCompare(b));
  const vendorFilterOptions = Array.from(new Set(customersData.rows.map((row) => row.vendorCode))).sort((a, b) => a.localeCompare(b));

  const query = params.q?.trim().toLowerCase() ?? "";
  const selectedZone = params.zone?.trim() ?? "";
  const selectedVendor = params.vendor?.trim() ?? "";
  const selectedActive = params.active?.trim() ?? "";

  const filteredRows = customersData.rows.filter((row) => {
    const matchesQuery = !query || row.customerName.toLowerCase().includes(query);
    const matchesZone = !selectedZone || row.zoneName === selectedZone;
    const matchesVendor = !selectedVendor || row.vendorCode === selectedVendor;
    const matchesActive = !selectedActive || (selectedActive === "activo" ? row.active : !row.active);
    return matchesQuery && matchesZone && matchesVendor && matchesActive;
  });

  return (
    <main className="space-y-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Clientes</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Maestro de clientes</h1>
      </header>

      <SectionCard title="Filtros" subtitle="Busqueda por nombre, zona, vendedor y estado.">
        <form method="get" className="grid gap-3 md:grid-cols-4 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Buscar cliente"
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 outline-none"
          />

          <select
            name="zone"
            defaultValue={selectedZone}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 outline-none"
          >
            <option value="">Todas las zonas</option>
            {zoneOptions.map((zone) => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>

          <select
            name="vendor"
            defaultValue={selectedVendor}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 outline-none"
          >
            <option value="">Todos los vendedores</option>
            {vendorFilterOptions.map((vendorCode) => (
              <option key={vendorCode} value={vendorCode}>{vendorCode}</option>
            ))}
          </select>

          <select
            name="active"
            defaultValue={selectedActive}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 outline-none"
          >
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>

          <button type="submit" className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold">
            Filtrar
          </button>
        </form>
      </SectionCard>

      <SectionCard
        title="Listado"
        subtitle={
          customersData.connected
            ? `Mostrando ${filteredRows.length} clientes de ${customersData.rows.length} cargados en Supabase. Tambien podes reasignar el vendedor manualmente desde esta tabla.`
            : customersData.errorMessage ?? "No se pudieron cargar clientes."
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--muted-foreground)]">
              <tr>
                {["Cliente", "Zona", "Vendedor", "Frecuencia", "Estado", "Reasignar"].map((head) => (
                  <th key={head} className="px-3 py-2 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr className="border-t border-[var(--border)]">
                  <td colSpan={6} className="px-3 py-4 text-[var(--muted-foreground)]">
                    No hay clientes para mostrar con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--border)] align-top">
                    <td className="px-3 py-3">{row.customerName}</td>
                    <td className="px-3 py-3">{row.zoneName}</td>
                    <td className="px-3 py-3">{row.vendorCode}</td>
                    <td className="px-3 py-3">{row.frequencyDays} dias</td>
                    <td className="px-3 py-3">{row.active ? "Activo" : "Inactivo"}</td>
                    <td className="px-3 py-3">
                      <CustomerAssignmentForm
                        customerId={row.id}
                        currentVendorId={row.vendorId || row.defaultVendorId}
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
