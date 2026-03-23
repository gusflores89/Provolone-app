"use client";

import { adminLogoutAction } from "@/app/admin/actions";

export function AdminLogoutForm() {
  return (
    <form action={adminLogoutAction}>
      <button
        type="submit"
        className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-medium text-[var(--muted-foreground)] transition hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Salir
      </button>
    </form>
  );
}
