import Link from "next/link";
import { SectionCard } from "@/components/shared/section-card";
import { getStatusCounts, getVendorTodayData } from "@/lib/vendor-live-data";
import { getCurrentVendorCode } from "@/lib/vendor-auth";

export default async function VendorTodayPage() {
  const vendorCode = await getCurrentVendorCode();
  const data = await getVendorTodayData(vendorCode);
  const counts = getStatusCounts(data.visits);
  const effectiveDateLabel = new Date(`${data.effectiveDate}T12:00:00`).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <main className="space-y-5 pb-24 pt-2">
      <SectionCard title={`Hola, ${data.vendor.name}`} subtitle={`Vendedor ${data.vendor.code}`}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-[var(--surface-alt)] p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Hoy</p>
            <p className="mt-2 text-2xl font-semibold">{counts.total}</p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-alt)] p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Visitados</p>
            <p className="mt-2 text-2xl font-semibold">{counts.visited}</p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-alt)] p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Pendientes</p>
            <p className="mt-2 text-2xl font-semibold">{counts.pending}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">Reprogramados: {counts.rescheduled}</p>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {data.usingFallbackDate
            ? `Mostrando la ultima fecha disponible para este vendedor: ${effectiveDateLabel}.`
            : `Fecha de agenda: ${effectiveDateLabel}.`}
        </p>
        {data.errorMessage ? (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">{data.errorMessage}</p>
        ) : null}
      </SectionCard>

      <SectionCard title="Mis clientes del dia" subtitle="Toca una tarjeta para ver direccion y cerrar la visita.">
        <div className="space-y-4">
          {data.visits.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-5 text-sm text-[var(--muted-foreground)]">
              No hay visitas disponibles para este vendedor.
            </div>
          ) : null}

          {data.visits.map((visit) => (
            <article key={visit.id} className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-alt)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
                    {visit.order}. {visit.zone}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">{visit.customerName}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{visit.address}</p>
                  <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{visit.status}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <a
                  href={visit.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-center text-sm font-semibold"
                >
                  Maps
                </a>
                <Link
                  href={`/vendedor/clientes/${visit.customerId}?visit=${visit.id}`}
                  className="rounded-2xl bg-[var(--primary)] px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  Ver
                </Link>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </main>
  );
}
