"use server";

import { revalidatePath } from "next/cache";
import { runGoogleSheetImport, type GoogleSheetImportResult } from "@/lib/google-sheet-import";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { assignZoneToVendor, rebalanceZonesAcrossVendors, type ZoneRebalanceResult } from "@/lib/zone-assignment";
import { generateWeeklyPlanForWeek, normalizeWeekStartDate, type WeeklyPlanGenerationResult } from "@/lib/weekly-planner";

type ImportActionState = GoogleSheetImportResult;
type PlanActionState = WeeklyPlanGenerationResult;

export async function runGoogleSheetImportAction(
  previousState: ImportActionState,
  formData: FormData,
): Promise<GoogleSheetImportResult> {
  void previousState;
  void formData;

  const result = await runGoogleSheetImport();
  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/zonas");
  revalidatePath("/admin/vendedores");
  revalidatePath("/admin/sync");
  return result;
}

export async function generateWeeklyPlanAction(
  previousState: PlanActionState,
  formData: FormData,
): Promise<WeeklyPlanGenerationResult> {
  void previousState;

  const requestedWeekStart = formData.get("weekStartDate")?.toString();
  const normalizedWeekStart = normalizeWeekStartDate(requestedWeekStart);
  const result = await generateWeeklyPlanForWeek(normalizedWeekStart);

  revalidatePath("/admin");
  revalidatePath("/admin/plan-semanal");
  revalidatePath("/admin/visitas");
  revalidatePath("/vendedor/hoy");
  return result;
}

export async function rebalanceZonesAction(
  previousState: ZoneRebalanceResult,
  formData: FormData,
): Promise<ZoneRebalanceResult> {
  void previousState;
  void formData;

  const result = await rebalanceZonesAcrossVendors();

  revalidatePath("/admin");
  revalidatePath("/admin/zonas");
  revalidatePath("/admin/vendedores");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/visitas");
  revalidatePath("/admin/plan-semanal");
  revalidatePath("/vendedor/hoy");
  return result;
}

export async function updateZoneVendorAssignmentSubmitAction(formData: FormData): Promise<void> {
  const zoneId = formData.get("zoneId")?.toString();
  const newVendorId = formData.get("vendorId")?.toString();

  if (!zoneId || !newVendorId) {
    return;
  }

  await assignZoneToVendor(zoneId, newVendorId);

  revalidatePath("/admin");
  revalidatePath("/admin/zonas");
  revalidatePath("/admin/vendedores");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/visitas");
  revalidatePath("/admin/plan-semanal");
  revalidatePath("/vendedor/hoy");
}

export async function updateCustomerVendorAssignmentSubmitAction(formData: FormData): Promise<void> {
  const customerId = formData.get("customerId")?.toString();
  const newVendorId = formData.get("vendorId")?.toString();
  const reason = formData.get("reason")?.toString().trim() || null;

  if (!customerId || !newVendorId) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const customerRes = await supabase
    .from("customers")
    .select("id,full_name,assigned_vendor_id,default_vendor_id")
    .eq("id", customerId)
    .maybeSingle();

  if (customerRes.error || !customerRes.data) {
    return;
  }

  const customer = customerRes.data;
  if (customer.assigned_vendor_id === newVendorId) {
    revalidatePath("/admin/clientes");
    return;
  }

  const vendorRes = await supabase
    .from("vendors")
    .select("id,vendor_code")
    .eq("id", newVendorId)
    .maybeSingle();

  if (vendorRes.error || !vendorRes.data) {
    return;
  }

  const assignmentMode = customer.default_vendor_id === newVendorId ? "zone_default" : "manual_override";

  await supabase
    .from("customers")
    .update({
      assigned_vendor_id: newVendorId,
      assignment_mode: assignmentMode,
    })
    .eq("id", customerId);

  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("daily_visits")
    .update({ vendor_id: newVendorId })
    .eq("customer_id", customerId)
    .eq("status", "pending")
    .gte("visit_date", today);

  await supabase
    .from("customer_vendor_overrides")
    .update({ active: false })
    .eq("customer_id", customerId)
    .eq("active", true);

  if (assignmentMode === "manual_override") {
    await supabase.from("customer_vendor_overrides").insert({
      customer_id: customerId,
      previous_vendor_id: customer.assigned_vendor_id,
      override_vendor_id: newVendorId,
      reason,
      active: true,
    });
  }

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/vendedores");
  revalidatePath("/admin/visitas");
  revalidatePath("/admin/plan-semanal");
  revalidatePath("/vendedor/hoy");
}
