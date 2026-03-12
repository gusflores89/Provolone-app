"use client";

import { useActionState } from "react";
import { generateWeeklyPlanAction } from "@/app/admin/actions";

type GenerationState = {
  ok: boolean;
  message: string;
};

const initialState: GenerationState = {
  ok: false,
  message: "",
};

export function GenerateWeeklyPlanForm({
  disabled,
  weekStartDate,
}: {
  disabled?: boolean;
  weekStartDate: string;
}) {
  const [state, formAction, pending] = useActionState(generateWeeklyPlanAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="weekStartDate" value={weekStartDate} />

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
        className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Generando..." : "Generar plan semanal"}
      </button>
    </form>
  );
}
