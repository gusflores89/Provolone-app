"use client";

import { useActionState } from "react";
import { runGoogleSheetImportAction } from "@/app/admin/actions";

type ImportState = {
  ok: boolean;
  message: string;
};

const initialState: ImportState = {
  ok: false,
  message: "",
};

export function SyncImportForm({ disabled }: { disabled: boolean }) {
  const [state, formAction, pending] = useActionState(runGoogleSheetImportAction, initialState);

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
        className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Importando..." : "Importar desde Google Sheets"}
      </button>
    </form>
  );
}
