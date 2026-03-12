import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/shared/section-card";
import { getCurrentVendorCode } from "@/lib/vendor-auth";
import { getVendorVisitDetail } from "@/lib/vendor-live-data";

export default async function VendorCustomerDetail({
  searchParams,
}: {
  searchParams: Promise<{ visit?: string }>;
}) {
  const { visit } = await searchParams;
  const vendorCode = await getCurrentVendorCode();

  if (!visit) {
    notFound();
  }

  const data = await getVendorVisitDetail(visit, vendorCode);

  if (!data.visit) {
    notFound();
  }

  return (
    <main className="space-y-5 pb-24 pt-2">
      <Link href="/vendedor/hoy" className="inline-flex text-sm font-semibold text-[var(--primary)]">
        Volver a hoy
      </Link>

      <SectionCard title={data.visit.customerName} subtitle={data.visit.zone}>
        <div className="space-y-5 text-sm leading-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Direccion</p>
            <p className="mt-2 text-base text-[var(--foreground)]">{data.visit.address}</p>
          </div>

          {data.visit.phone ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Telefono</p>
              <p className="mt-2 text-base text-[var(--foreground)]">{data.visit.phone}</p>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Notas</p>
            <p className="mt-2 text-base text-[var(--foreground)]">{data.visit.notes || "Sin notas cargadas."}</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <a
            href={data.visit.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-4 text-center text-sm font-semibold"
          >
            Abrir en Maps
          </a>
          {data.visit.phone ? (
            <a
              href={`tel:${data.visit.phone}`}
              className="block rounded-2xl border border-[var(--border)] bg-white px-4 py-4 text-center text-sm font-semibold"
            >
              Llamar
            </a>
          ) : null}
          <Link
            href={`/vendedor/visitas/${data.visit.id}/cerrar`}
            className="block rounded-2xl bg-[var(--primary)] px-4 py-4 text-center text-sm font-semibold text-white"
          >
            Cerrar visita
          </Link>
        </div>
      </SectionCard>
    </main>
  );
}
