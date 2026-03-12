import { SectionCard } from "@/components/shared/section-card";
import { getAdminVisits, getAdminVendors } from "@/lib/admin-live-data";

type SearchParams = Promise<{ q?: string; vendor?: string; status?: string; date?: string }> | { q?: string; vendor?: string; status?: string; date?: string };

export default async function AdminVisitsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = (await Promise.resolve(searchParams)) ?? {};
  const [visitsData, vendorsData] = await Promise.all([getAdminVisits(300), getAdminVendors()]);

  const vendorFilterOptions = Array.from(new Set(vendorsData.rows.map((row) => row.vendorCode))).sort((a, b) => a.localeCompare(b));
  const statusOptions = Array.from(new Set(visitsData.rows.map((row) => row.status))).sort((a, b) => a.localeCompare(b));

  const query = params.q?.trim().toLowerCase() ?? "";
  const selectedVendor = params.vendor?.trim() ?? "";
  const selectedStatus = params.status?.trim() ?? "";
  const selectedDate = params.date?.trim() ?? "";

  const filteredRows = visitsData.rows.filter((row) => {
    const matchesQuery = !query || row.customerName.toLowerCase().includes(query);
    const matchesVendor = !selectedVendor || row.vendorCode === selectedVendor;
    const matchesStatus = !selectedStatus || row.status === selectedStatus;
    const matchesDate = !selectedDate || row.visitDateLabel === new Date(`${selectedDate}T00:00:00`).toLocaleDateString("es-AR");
    return matchesQuery && matchesVendor && matchesStatus && matchesDate;
  });

  return (
    <main className="space-y-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Visitas</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Seguimiento operativo</h1>
      </header>

      <SectionCard title="Filtros" subtitle="Filtra por fecha, vendedor, estado y cliente.">
        <form method="get" className="grid gap-3 md:grid-cols-4 xl:grid-cols-[1fr_1fr_1fr_2fr_auto]">
          <input
            name="date"
            type="date"
            defaultValue={selectedDate}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 outline-none"
          />

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
            name="status"
            defaultValue={selectedStatus}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 outline-none"
          >
            <option value="">Todos los estados</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Buscar cliente"
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 outline-none"
          />

          <button type="submit" className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold">
            Filtrar
          </button>
        </form>
      </SectionCard>

      <SectionCard
        title="Listado de visitas"
        subtitle={
          visitsData.connected
            ? `Mostrando ${filteredRows.length} visitas de ${visitsData.rows.length} registradas en Supabase.`
            : visitsData.errorMessage ?? "No se pudieron cargar visitas."
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--muted-foreground)]">
              <tr>
                {["Cliente", "Vendedor", "Fecha", "Estado", "Comentario"].map((head) => (
                  <th key={head} className="px-3 py-2 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr className="border-t border-[var(--border)]">
                  <td colSpan={5} className="px-3 py-4 text-[var(--muted-foreground)]">
                    No hay visitas para mostrar con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-3">{row.customerName}</td>
                    <td className="px-3 py-3">{row.vendorCode}</td>
                    <td className="px-3 py-3">{row.visitDateLabel}</td>
                    <td className="px-3 py-3">{row.status}</td>
                    <td className="px-3 py-3">{row.comment}</td>
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
