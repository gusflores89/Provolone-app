import { SectionCard } from "@/components/shared/section-card";
import { getAdminLiveStats } from "@/lib/admin-live-data";

export default async function AdminDashboardPage() {
  const liveStats = await getAdminLiveStats();

  const kpis = [
    { label: "Clientes activos", value: liveStats.customers.toLocaleString("es-AR") },
    { label: "Zonas activas", value: String(liveStats.zones) },
    { label: "Vendedores activos", value: String(liveStats.vendors) },
    { label: "Visitas de hoy", value: liveStats.visitsToday.toLocaleString("es-AR") },
  ];

  const syncRows = liveStats.syncRuns.length > 0
    ? liveStats.syncRuns.map((row) => [
        new Date(row.started_at).toLocaleString("es-AR"),
        row.status,
        String(row.inserted_count),
        String(row.updated_count),
        String(row.error_count),
      ])
    : [["Sin corridas aun", liveStats.connected ? "OK" : "Pendiente", "0", "0", "0"]];

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight">Operacion de la semana</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Vista general para clientes, zonas, visitas y sincronizacion.
        </p>
      </header>

      <SectionCard
        title={liveStats.connected ? "Supabase conectado" : "Panel sin conexion"}
        subtitle={
          liveStats.connected
            ? "El panel ya esta leyendo datos reales del proyecto Provolone."
            : liveStats.errorMessage ?? "Configura las variables de entorno para activar datos reales."
        }
      >
        <div className="text-sm text-[var(--muted-foreground)]">
          {liveStats.connected
            ? "Los indicadores y alertas de abajo ya salen de Supabase y del historial de sincronizacion."
            : "El panel no puede consultar la base. Revisemos la configuracion antes de seguir operando."}
        </div>
      </SectionCard>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <SectionCard key={item.label} title={item.value} subtitle={item.label}>
            <div />
          </SectionCard>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Alertas" subtitle="Prioridades para revisar hoy.">
          <ul className="space-y-3 text-sm text-[var(--muted-foreground)]">
            {liveStats.alerts.map((alert) => (
              <li key={alert} className="rounded-2xl bg-[var(--surface-alt)] px-4 py-3">
                {alert}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Ultimas sincronizaciones" subtitle="Vista rapida del estado Sheet -> app.">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[var(--muted-foreground)]">
                <tr>
                  {["Inicio", "Estado", "Insert", "Update", "Error"].map((head) => (
                    <th key={head} className="px-3 py-2 font-semibold">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {syncRows.map((row, rowIndex) => (
                  <tr key={`${row.join("-")}-${rowIndex}`} className="border-t border-[var(--border)]">
                    {row.map((cell, cellIndex) => (
                      <td key={`${cell}-${cellIndex}`} className="px-3 py-3">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
