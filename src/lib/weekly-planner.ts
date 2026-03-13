import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase";

const WORKING_DAY_COUNT = 5;

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseSupportedDate(rawValue: string) {
  const trimmed = rawValue.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export function formatIsoDateForAr(isoDate: string) {
  const parsed = parseSupportedDate(isoDate);
  if (!parsed) {
    return isoDate;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getWeekStartDate(date = new Date()) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function normalizeWeekStartDate(rawWeekStartDate?: string) {
  if (!rawWeekStartDate) {
    return toIsoDate(getWeekStartDate());
  }

  const parsed = parseSupportedDate(rawWeekStartDate);
  if (!parsed) {
    return toIsoDate(getWeekStartDate());
  }

  return toIsoDate(getWeekStartDate(parsed));
}

export function getWorkingWeekDateRange(rawWeekStartDate?: string) {
  const normalizedWeekStart = normalizeWeekStartDate(rawWeekStartDate);
  const startDate = new Date(`${normalizedWeekStart}T00:00:00`);

  return {
    weekStartDate: normalizedWeekStart,
    startDate,
    endDate: addDays(startDate, WORKING_DAY_COUNT - 1),
    dayDates: Array.from({ length: WORKING_DAY_COUNT }, (_, index) => toIsoDate(addDays(startDate, index))),
  };
}

export type WeeklyPlanGenerationResult = {
  ok: boolean;
  message: string;
};

export async function generateWeeklyPlanForWeek(rawWeekStartDate?: string): Promise<WeeklyPlanGenerationResult> {
  if (!hasSupabaseEnv()) {
    return {
      ok: false,
      message: "Faltan variables de Supabase para generar el plan semanal.",
    };
  }

  const supabase = createSupabaseAdminClient();
  const { weekStartDate, endDate } = getWorkingWeekDateRange(rawWeekStartDate);
  const weekEndDate = toIsoDate(endDate);

  const existingPlanRes = await supabase
    .from("weekly_plans")
    .select("id,status")
    .eq("week_start_date", weekStartDate)
    .maybeSingle();

  if (existingPlanRes.error) {
    return { ok: false, message: existingPlanRes.error.message };
  }

  let weeklyPlanId = existingPlanRes.data?.id ?? null;

  if (!weeklyPlanId) {
    const createPlanRes = await supabase
      .from("weekly_plans")
      .insert({
        week_start_date: weekStartDate,
        status: "draft",
        notes: "Plan generado automaticamente desde el panel admin.",
      })
      .select("id")
      .single();

    if (createPlanRes.error || !createPlanRes.data) {
      return {
        ok: false,
        message: createPlanRes.error?.message ?? "No pudimos crear el plan semanal.",
      };
    }

    weeklyPlanId = createPlanRes.data.id;
  }

  const [existingVisitsRes, customersRes] = await Promise.all([
    supabase
      .from("daily_visits")
      .select("customer_id,vendor_id,visit_date,planned_order")
      .eq("weekly_plan_id", weeklyPlanId),
    supabase
      .from("customers")
      .select("id,full_name,zone_id,assigned_vendor_id,active")
      .eq("active", true)
      .order("assigned_vendor_id", { ascending: true })
      .order("zone_id", { ascending: true })
      .order("full_name", { ascending: true }),
  ]);

  if (existingVisitsRes.error) {
    return { ok: false, message: existingVisitsRes.error.message };
  }

  if (customersRes.error) {
    return { ok: false, message: customersRes.error.message };
  }

  const customers = customersRes.data ?? [];
  if (customers.length === 0) {
    return { ok: false, message: "No hay clientes activos para generar visitas." };
  }

  const existingCustomerIds = new Set((existingVisitsRes.data ?? []).map((visit) => visit.customer_id));
  const orderCounterByVendorDay = new Map<string, number>();

  for (const visit of existingVisitsRes.data ?? []) {
    const key = `${visit.vendor_id}-${visit.visit_date}`;
    const currentOrder = visit.planned_order ?? 0;
    orderCounterByVendorDay.set(key, Math.max(orderCounterByVendorDay.get(key) ?? 0, currentOrder));
  }

  const groupedCustomers = new Map<string, typeof customers>();
  for (const customer of customers) {
    if (!customer.assigned_vendor_id || !customer.zone_id || existingCustomerIds.has(customer.id)) {
      continue;
    }

    const list = groupedCustomers.get(customer.assigned_vendor_id) ?? [];
    list.push(customer);
    groupedCustomers.set(customer.assigned_vendor_id, list);
  }

  const { dayDates } = getWorkingWeekDateRange(weekStartDate);
  const visitPayload: Array<Record<string, unknown>> = [];

  for (const [vendorId, vendorCustomers] of groupedCustomers.entries()) {
    vendorCustomers.forEach((customer, index) => {
      const visitDate = dayDates[index % WORKING_DAY_COUNT];
      const orderKey = `${vendorId}-${visitDate}`;
      const plannedOrder = (orderCounterByVendorDay.get(orderKey) ?? 0) + 1;
      orderCounterByVendorDay.set(orderKey, plannedOrder);

      visitPayload.push({
        weekly_plan_id: weeklyPlanId,
        visit_date: visitDate,
        customer_id: customer.id,
        vendor_id: vendorId,
        zone_id: customer.zone_id,
        planned_order: plannedOrder,
        status: "pending",
        original_visit_date: visitDate,
        has_order: null,
        comment: null,
        rescheduled_to: null,
        visited_at: null,
      });
    });
  }

  if (visitPayload.length === 0) {
    return {
      ok: true,
      message: `La semana ${formatIsoDateForAr(weekStartDate)} ya tenia visitas generadas para todos los clientes activos. No hubo cambios.`,
    };
  }

  const insertVisitsRes = await supabase.from("daily_visits").insert(visitPayload);
  if (insertVisitsRes.error) {
    return { ok: false, message: insertVisitsRes.error.message };
  }

  const touchPlanRes = await supabase
    .from("weekly_plans")
    .update({
      status: "draft",
      notes: `Plan actualizado para ${formatIsoDateForAr(weekStartDate)} a ${formatIsoDateForAr(weekEndDate)}.`,
    })
    .eq("id", weeklyPlanId);

  if (touchPlanRes.error) {
    return { ok: false, message: touchPlanRes.error.message };
  }

  return {
    ok: true,
    message: `Plan semanal actualizado. Se agregaron ${visitPayload.length} visitas entre ${formatIsoDateForAr(weekStartDate)} y ${formatIsoDateForAr(weekEndDate)}.`,
  };
}
