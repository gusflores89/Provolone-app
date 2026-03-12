"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase";

const statusToDb = {
  "Visitado con pedido": "visited_with_order",
  "Visitado sin pedido": "visited_without_order",
  Reprogramado: "rescheduled",
  "No visitado": "not_visited",
} as const;

export async function submitVisitResult(formData: FormData) {
  const visitId = String(formData.get("visitId") ?? "");
  const vendorCode = String(formData.get("vendorCode") ?? "V001");
  const selectedStatus = String(formData.get("status") ?? "Visitado con pedido");
  const comment = String(formData.get("comment") ?? "").trim();
  const rescheduledTo = String(formData.get("rescheduledTo") ?? "").trim();

  if (!visitId) {
    redirect(`/vendedor/hoy?vendor=${vendorCode}`);
  }

  if (hasSupabaseEnv()) {
    const supabase = createSupabaseServerClient();
    const dbStatus = statusToDb[selectedStatus as keyof typeof statusToDb] ?? "visited_with_order";

    const payload: {
      status: string;
      comment: string | null;
      has_order: boolean | null;
      rescheduled_to: string | null;
      visited_at: string | null;
    } = {
      status: dbStatus,
      comment: comment || null,
      has_order:
        dbStatus === "visited_with_order"
          ? true
          : dbStatus === "visited_without_order"
            ? false
            : null,
      rescheduled_to: dbStatus === "rescheduled" && rescheduledTo ? rescheduledTo : null,
      visited_at: dbStatus === "rescheduled" ? null : new Date().toISOString(),
    };

    await supabase.from("daily_visits").update(payload).eq("id", visitId);

    await supabase.from("visit_events").insert({
      daily_visit_id: visitId,
      event_type: dbStatus === "rescheduled" ? "rescheduled" : "status_changed",
      new_status: dbStatus,
      comment: comment || null,
      actor_type: "system",
    });
  }

  revalidatePath(`/vendedor/hoy`);
  revalidatePath(`/vendedor/clientes`);
  revalidatePath(`/vendedor/visitas`);

  redirect(`/vendedor/hoy?vendor=${vendorCode}`);
}
