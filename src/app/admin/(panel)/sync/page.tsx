import { SectionCard } from "@/components/shared/section-card";
import { SyncImportForm } from "@/components/admin/sync-import-form";
import { getSyncOverview } from "@/lib/google-sheet-import";

export default async function AdminSyncPage() {
  const overview = await getSyncOverview();

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--primary)]">Sincronizacion</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Google Sheets a Supabase</h1>
        </div>
        <SyncImportForm disabled={!overview.configured} />
      </header>

      <SectionCard
        title={overview.configured ? "Importador listo" : "Falta configuracion"}
        subtitle={overview.message}
      >
        <div className="space-y-3 text-sm leading-7 text-[var(--muted-foreground)]">
          <p>El importador espera un Google Sheet con pestañas `VENDEDORES`, `ZONAS` y `CLIENTES`.</p>
          <p>
            La cuenta de servicio de Google debe tener acceso de lectura al sheet, y el proyecto necesita una
            `SUPABASE_SERVICE_ROLE_KEY` para escribir en la base.
          </p>
          <p>
            Para vendedores nuevos, el importador crea un PIN temporal usando `IMPORT_DEFAULT_VENDOR_PIN`.
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Historial" subtitle="Ultimas corridas registradas en sync_runs.">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--muted-foreground)]">
              <tr>
                {['Inicio','Fin','Estado','Insert','Update','Error'].map((head) => (
                  <th key={head} className="px-3 py-2 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overview.syncRuns.length === 0 ? (
                <tr className="border-t border-[var(--border)]">
                  <td colSpan={6} className="px-3 py-4 text-[var(--muted-foreground)]">
                    Todavia no hay corridas de importacion.
                  </td>
                </tr>
              ) : (
                overview.syncRuns.map((row, rowIndex) => (
                  <tr key={`${row.id}-${rowIndex}`} className="border-t border-[var(--border)]">
                    <td className="px-3 py-3">{new Date(row.started_at).toLocaleString("es-AR")}</td>
                    <td className="px-3 py-3">{row.finished_at ? new Date(row.finished_at).toLocaleString("es-AR") : "-"}</td>
                    <td className="px-3 py-3">{row.status}</td>
                    <td className="px-3 py-3">{row.inserted_count}</td>
                    <td className="px-3 py-3">{row.updated_count}</td>
                    <td className="px-3 py-3">{row.error_count}</td>
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
