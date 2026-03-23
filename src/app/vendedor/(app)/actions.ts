"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { orderCustomersByNearestNeighbor } from "@/lib/route-planning";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getVendorSession } from "@/lib/vendor-session";

const statusToDb = {
  "Visitado con pedido": "visited_with_order",
  "Visitado sin pedido": "visited_without_order",
  Reprogramado: "rescheduled",
  "No visitado": "not_visited",
} as const;

type ReorderVisitRow = {
  id: string;
  planned_order: number | null;
  status: string;
  customer_id: string;
  customers:
    | {
        lat: number | string | null;
        lng: number | string | null;
      }
    | null
    | Array<{
        lat: number | string | null;
        lng: number | string | null;
      }>;
};

export async function submitVisitResult(formData: FormData) {
  const visitId = String(formData.get("visitId") ?? "");
  const vendorCode = String(formData.get("vendorCode") ?? "");
  const selectedStatus = String(formData.get("status") ?? "Visitado con pedido");
  const comment = String(formData.get("comment") ?? "").trim();
  const rescheduledTo = String(formData.get("rescheduledTo") ?? "").trim();

  if (!visitId) {
    redirect("/vendedor/hoy");
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

  revalidatePath("/vendedor/hoy");
  revalidatePath("/vendedor/clientes");
  revalidatePath("/vendedor/visitas");

  if (vendorCode) {
    redirect(`/vendedor/hoy?vendor=${vendorCode}`);
  }

  redirect("/vendedor/hoy");
}

export async function reorderVendorRouteAction(formData: FormData) {
  const effectiveDate = String(formData.get("effectiveDate") ?? "").trim();
  const session = await getVendorSession();

  if (!session || !effectiveDate || !hasSupabaseEnv()) {
    redirect("/vendedor/hoy");
  }

  const supabase = createSupabaseServerClient();
  const vendorRes = await supabase
    .from("vendors")
    .select("id")
    .eq("vendor_code", session.vendorCode)
    .maybeSingle();

  if (vendorRes.error || !vendorRes.data) {
    redirect("/vendedor/hoy");
  }

  const visitsRes = await supabase
    .from("daily_visits")
    .select(`
      id,
      planned_order,
      status,
      customer_id,
      customers!daily_visits_customer_id_fkey(lat,lng)
    `)
    .eq("vendor_id", vendorRes.data.id)
    .eq("visit_date", effectiveDate)
    .order("planned_order", { ascending: true });

  if (visitsRes.error || !(visitsRes.data?.length)) {
    revalidatePath("/vendedor/hoy");
    redirect("/vendedor/hoy");
  }

  const rows = (visitsRes.data ?? []) as ReorderVisitRow[];
  const lockedRows = rows.filter((row) => row.status !== "pending");
  const pendingRows = rows.filter((row) => row.status === "pending");

  const orderedPendingRows = orderCustomersByNearestNeighbor(
    pendingRows.map((row) => {
      const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;

      return {
        ...row,
        lat: customer?.lat ?? null,
        lng: customer?.lng ?? null,
      };
    }),
  );

  const visitOrder = [...lockedRows, ...orderedPendingRows];

  await Promise.all(
    visitOrder.map((visit, index) =>
      supabase
        .from("daily_visits")
        .update({ planned_order: index + 1 })
        .eq("id", visit.id),
    ),
  );

  revalidatePath("/vendedor/hoy");
  revalidatePath("/vendedor/clientes");
  revalidatePath("/vendedor/visitas");

  redirect("/vendedor/hoy");
}
