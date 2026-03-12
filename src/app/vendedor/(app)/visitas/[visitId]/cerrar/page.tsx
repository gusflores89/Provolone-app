import Link from "next/link";
import { SectionCard } from "@/components/shared/section-card";
import { submitVisitResult } from "@/app/vendedor/(app)/actions";
import { getCurrentVendorCode } from "@/lib/vendor-auth";
import { getVendorVisitDetail } from "@/lib/vendor-live-data";

const statusOptions = [
  "Visitado con pedido",
  "Visitado sin pedido",
  "Reprogramado",
  "No visitado",
] as const;

export default async function VisitClosePage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const vendorCode = await getCurrentVendorCode();
  const data = await getVendorVisitDetail(visitId, vendorCode);

  if (!data.visit) {
    return (
      <main className="space-y-5 pb-24 pt-2">
        <SectionCard title="Visita no encontrada" subtitle="No pudimos cargar esta visita para el vendedor actual.">
          <Link href="/vendedor/hoy" className="inline-flex rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white">
            Volver a hoy
          </Link>
        </SectionCard>
      </main>
    );
  }

  return (
    <main className="space-y-5 pb-24 pt-2">
      <Link href={`/vendedor/clientes/${data.visit.customerId}?visit=${data.visit.id}`} className="inline-flex text-sm font-semibold text-[var(--primary)]">
        Cliente
      </Link>

      <SectionCard title="Cerrar visita" subtitle={data.visit.customerName}>
        <form action={submitVisitResult} className="space-y-5">
          <input type="hidden" name="visitId" value={data.visit.id} />
          <input type="hidden" name="vendorCode" value={data.vendor.code} />

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-[var(--foreground)]">Resultado</legend>
            {statusOptions.map((status) => (
              <label
                key={status}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-4 text-sm font-medium"
              >
                <input
                  type="radio"
                  name="status"
                  value={status}
                  className="accent-[var(--primary)]"
                  defaultChecked={status === "Visitado con pedido"}
                />
                {status}
              </label>
            ))}
          </fieldset>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Comentario opcional</span>
            <textarea
              rows={4}
              name="comment"
              placeholder="Escribi un comentario si hace falta"
              defaultValue={data.visit.comment}
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-4 outline-none transition focus:border-[var(--primary)]"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Nueva fecha si reprogramas</span>
            <input
              type="date"
              name="rescheduledTo"
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-4 outline-none transition focus:border-[var(--primary)]"
              defaultValue={data.visit.rescheduledTo || new Date().toISOString().slice(0, 10)}
            />
          </label>

          <button
            type="submit"
            className="block w-full rounded-2xl bg-[var(--primary)] px-4 py-4 text-center text-sm font-semibold text-white"
          >
            Guardar resultado
          </button>
        </form>
      </SectionCard>
    </main>
  );
}
