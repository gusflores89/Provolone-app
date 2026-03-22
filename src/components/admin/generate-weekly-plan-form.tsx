"use client";

import { useActionState, useState } from "react";
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
  initialWeekStartDate,
}: {
  disabled?: boolean;
  initialWeekStartDate: string;
}) {
  const [state, formAction, pending] = useActionState(generateWeeklyPlanAction, initialState);
  const [weekValue, setWeekValue] = useState(initialWeekStartDate);

  return (
    <div className="space-y-3">
      <form method="get" className="space-y-2">
        <label htmlFor="week" className="block text-sm font-semibold text-[var(--foreground)]">
          Semana a revisar
        </label>
        <div className="flex gap-3">
          <input
            id="week"
            name="week"
            type="text"
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            value={weekValue}
            onChange={(event) => setWeekValue(event.target.value)}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 outline-none"
          />
          <button
            type="submit"
            className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold"
          >
            Ver
          </button>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">Formato: dd/mm/aaaa</p>
      </form>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="weekStartDate" value={weekValue} />

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
    </div>
  );
}
