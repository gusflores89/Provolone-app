"use client";

import { useActionState } from "react";
import { rebalanceZonesAction } from "@/app/admin/actions";

type RebalanceState = {
  ok: boolean;
  message: string;
};

const initialState: RebalanceState = {
  ok: false,
  message: "",
};

export function RebalanceZonesForm({ disabled }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(rebalanceZonesAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      {state.message ? (
        <p
          className={`rounded-2xl px-4 py-3 text-sm ${
            state.ok
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={disabled || pending}
        className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Rebalanceando..." : "Rebalancear zonas"}
      </button>
    </form>
  );
}
