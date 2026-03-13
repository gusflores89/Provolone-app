import { GenerateWeeklyPlanForm } from "@/components/admin/generate-weekly-plan-form";
import { SectionCard } from "@/components/shared/section-card";
import { getAdminWeeklyPlanData } from "@/lib/admin-live-data";
import { formatIsoDateForAr, normalizeWeekStartDate } from "@/lib/weekly-planner";

const dayLabels = ["Lun", "Mar", "Mie", "Jue", "Vie"];

type SearchParams = Promise<{ week?: string }> | { week?: string };

export default async function AdminWeeklyPlanPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = (await Promise.resolve(searchParams)) ?? {};
  const selectedWeek = normalizeWeekStartDate(params.week);
  const data = await getAdminWeeklyPlanData(selectedWeek);

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Plan semanal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{data.weekLabel}</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Estado actual: {data.planStatus}. Total de visitas programadas: {data.totalVisits.toLocaleString("es-AR")}.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(240px,1fr)_minmax(240px,1fr)] md:items-end">
          <form method="get" className="space-y-2">
            <label htmlFor="week" className="block text-sm font-semibold text-[var(--foreground)]">
              Semana a revisar
            </label>
            <div className="flex gap-3">
              <input
                id="week"
                name="week"
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                defaultValue={formatIsoDateForAr(data.weekStartDate)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 outline-none"
              />
              <button
                type="submit"
                className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold"
              >
                Ver
              </button>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">Formato: dd/mm/aaaa</p>
          </form>

          <div className="w-full max-w-sm xl:justify-self-end">
            <GenerateWeeklyPlanForm disabled={!data.connected} weekStartDate={data.weekStartDate} />
          </div>
        </div>
      </header>

      <SectionCard
        title="Carga por vendedor"
        subtitle={
          data.connected
            ? "Matriz real del planner semanal generada desde clientes activos y vendedores asignados."
            : data.errorMessage ?? "No se pudo leer el planner semanal."
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--muted-foreground)]">
              <tr>
                {["Vendedor", ...dayLabels, "Total", "Estado"].map((head) => (
                  <th key={head} className="px-3 py-2 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr className="border-t border-[var(--border)]">
                  <td colSpan={8} className="px-3 py-4 text-[var(--muted-foreground)]">
                    No hay vendedores o visitas programadas para esta semana.
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.vendorId} className="border-t border-[var(--border)]">
                    <td className="px-3 py-3">
                      <div className="font-medium text-[var(--foreground)]">{row.fullName}</div>
                      <div className="text-xs uppercase tracking-[0.15em] text-[var(--muted-foreground)]">{row.vendorCode}</div>
                    </td>
                    {row.dayLoads.map((count, index) => (
                      <td key={`${row.vendorId}-${dayLabels[index]}`} className="px-3 py-3">{count}</td>
                    ))}
                    <td className="px-3 py-3 font-medium">{row.total}</td>
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
