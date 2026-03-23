"use client";

import { useActionState } from "react";
import { adminLoginAction, type AdminLoginState } from "@/app/admin/actions";

const initialState: AdminLoginState = {};

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLoginAction, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Email</span>
        <input
          type="email"
          name="email"
          placeholder="admin@fiambrieria.com"
          autoComplete="username"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-4 outline-none transition focus:border-[var(--primary)]"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Clave</span>
        <input
          type="password"
          name="password"
          placeholder="••••••••"
          autoComplete="current-password"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-4 outline-none transition focus:border-[var(--primary)]"
        />
      </label>

      {state.error ? (
        <p className="rounded-2xl border border-[var(--danger)]/20 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="block w-full rounded-2xl bg-[var(--primary)] px-5 py-4 text-center text-base font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
