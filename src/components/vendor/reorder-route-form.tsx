"use client";

import { useFormStatus } from "react-dom";
import { reorderVendorRouteAction } from "@/app/vendedor/(app)/actions";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Reordenando..." : "Reordenar ruta"}
    </button>
  );
}

export function ReorderRouteForm({
  effectiveDate,
  disabled,
}: {
  effectiveDate: string;
  disabled?: boolean;
}) {
  return (
    <form action={reorderVendorRouteAction}>
      <input type="hidden" name="effectiveDate" value={effectiveDate} />
      <SubmitButton disabled={disabled} />
    </form>
  );
}
