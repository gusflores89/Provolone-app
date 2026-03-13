import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase";
import { getWorkingWeekDateRange, normalizeWeekStartDate } from "@/lib/weekly-planner";

const visitStatusLabelMap = {
  pending: "Pendiente",
  visited_with_order: "Visitado con pedido",
  visited_without_order: "Visitado sin pedido",
  rescheduled: "Reprogramado",
  not_visited: "No visitado",
  cancelled: "Cancelado",
} as const;

export type AdminLiveStats = {
  connected: boolean;
  customers: number;
  zones: number;
  vendors: number;
  visitsToday: number;
  alerts: string[];
  syncRuns: Array<{
    started_at: string;
    status: string;
    inserted_count: number;
    updated_count: number;
    error_count: number;
  }>;
  errorMessage?: string;
};

export type AdminCustomerRow = {
  id: string;
  customerName: string;
  zoneName: string;
  vendorCode: string;
  vendorId: string;
  defaultVendorId: string;
  frequencyDays: number;
  active: boolean;
};

export type AdminZoneRow = {
  id: string;
  zoneCode: string;
  zoneName: string;
  vendorCode: string;
  vendorId: string;
  customerCount: number;
  weeklyTarget: number;
  status: string;
};

export type AdminVendorRow = {
  id: string;
  vendorCode: string;
  fullName: string;
  zoneCount: number;
  customerCount: number;
  status: string;
};

export type AdminVisitRow = {
  id: string;
  customerName: string;
  vendorCode: string;
  visitDateLabel: string;
  status: string;
  comment: string;
};

export type AdminWeeklyPlanRow = {
  vendorId: string;
  vendorCode: string;
  fullName: string;
  dayLoads: number[];
  total: number;
  status: string;
};

function getSupabaseOrNull() {
  if (!hasSupabaseEnv()) {
    return null;
  }

  try {
    return createSupabaseAdminClient();
  } catch {
    return createSupabaseServerClient();
  }
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-AR");
}

function formatWeekLabel(weekStartDate: string) {
  const weekStart = new Date(`${weekStartDate}T00:00:00`);
  return `Semana del ${weekStart.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
  })}`;
}

function buildAdminAlerts(input: {
  customers: number;
  zones: number;
  vendors: number;
  visitsToday: number;
  syncRuns: AdminLiveStats["syncRuns"];
}) {
  const alerts: string[] = [];

  if (input.customers === 0) {
    alerts.push("Todavia no hay clientes importados desde Google Sheets.");
  }

  if (input.vendors === 0) {
    alerts.push("No hay vendedores activos cargados en la base.");
  }

  if (input.zones > 0 && input.vendors > 0 && input.zones > input.vendors) {
    alerts.push("Hay mas zonas activas que vendedores cargados. Revisar asignaciones.");
  }

  if (input.visitsToday === 0) {
    alerts.push("No hay visitas generadas para hoy.");
  }

  const latestSync = input.syncRuns[0];
  if (latestSync?.status === "warning") {
    alerts.push("La ultima sincronizacion tuvo advertencias.");
  }
  if (latestSync?.status === "failed") {
    alerts.push("La ultima sincronizacion fallo y necesita revision.");
  }

  if (alerts.length === 0) {
    alerts.push("Sin alertas criticas. La operacion se ve estable.");
  }

  return alerts;
}

export async function getAdminLiveStats(): Promise<AdminLiveStats> {
  const supabase = getSupabaseOrNull();

  if (!supabase) {
    return {
      connected: false,
      customers: 0,
      zones: 0,
      vendors: 0,
      visitsToday: 0,
      alerts: ["Configura Supabase para ver estadisticas reales."],
      syncRuns: [],
      errorMessage: "Faltan variables de entorno de Supabase.",
    };
  }

  try {
    const today = toIsoDate(new Date());

    const [customersRes, zonesRes, vendorsRes, visitsRes, syncRunsRes] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("zones").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("vendors").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("daily_visits").select("id", { count: "exact", head: true }).eq("visit_date", today),
      supabase
        .from("sync_runs")
        .select("started_at,status,inserted_count,updated_count,error_count")
        .order("started_at", { ascending: false })
        .limit(5),
    ]);

    const firstError = [customersRes.error, zonesRes.error, vendorsRes.error, visitsRes.error, syncRunsRes.error].find(Boolean);

    if (firstError) {
      return {
        connected: false,
        customers: 0,
        zones: 0,
        vendors: 0,
        visitsToday: 0,
        alerts: ["No pudimos leer estadisticas reales del panel."],
        syncRuns: [],
        errorMessage: firstError.message,
      };
    }

    const customers = customersRes.count ?? 0;
    const zones = zonesRes.count ?? 0;
    const vendors = vendorsRes.count ?? 0;
    const visitsToday = visitsRes.count ?? 0;
    const syncRuns = syncRunsRes.data ?? [];

    return {
      connected: true,
      customers,
      zones,
      vendors,
      visitsToday,
      alerts: buildAdminAlerts({ customers, zones, vendors, visitsToday, syncRuns }),
      syncRuns,
    };
  } catch (error) {
    return {
      connected: false,
      customers: 0,
      zones: 0,
      vendors: 0,
      visitsToday: 0,
      alerts: ["No pudimos leer estadisticas reales del panel."],
      syncRuns: [],
      errorMessage: error instanceof Error ? error.message : "Error desconocido de Supabase.",
    };
  }
}

export async function getAdminCustomers(limit = 100) {
  const supabase = getSupabaseOrNull();

  if (!supabase) {
    return { connected: false, rows: [] as AdminCustomerRow[], errorMessage: "Supabase no configurado." };
  }

  const { data, error } = await supabase
    .from("customers")
    .select(
      `
        id,
        full_name,
        visit_frequency_days,
        active,
        assigned_vendor_id,
        default_vendor_id,
        zones!customers_zone_id_fkey(zone_name),
        vendors!customers_assigned_vendor_id_fkey(vendor_code)
      `,
    )
    .order("full_name", { ascending: true })
    .limit(limit);

  if (error) {
    return { connected: false, rows: [] as AdminCustomerRow[], errorMessage: error.message };
  }

  const rows: AdminCustomerRow[] = (data ?? []).map((row) => {
    const zone = Array.isArray(row.zones) ? row.zones[0] : row.zones;
    const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;

    return {
      id: row.id,
      customerName: row.full_name ?? "Sin nombre",
      zoneName: zone?.zone_name ?? "Sin zona",
      vendorCode: vendor?.vendor_code ?? "Sin vendedor",
      vendorId: row.assigned_vendor_id ?? "",
      defaultVendorId: row.default_vendor_id ?? "",
      frequencyDays: row.visit_frequency_days ?? 7,
      active: Boolean(row.active),
    };
  });

  return { connected: true, rows };
}

export async function getAdminZones() {
  const supabase = getSupabaseOrNull();

  if (!supabase) {
    return { connected: false, rows: [] as AdminZoneRow[], errorMessage: "Supabase no configurado." };
  }

  const [{ data: zonesData, error: zonesError }, { data: customersData, error: customersError }] = await Promise.all([
    supabase
      .from("zones")
      .select(
        `
          id,
          zone_code,
          zone_name,
          weekly_target,
          current_vendor_id,
          vendors!zones_current_vendor_id_fkey(vendor_code)
        `,
      )
      .order("zone_code", { ascending: true }),
    supabase.from("customers").select("zone_id").eq("active", true),
  ]);

  if (zonesError || customersError) {
    return {
      connected: false,
      rows: [] as AdminZoneRow[],
      errorMessage: zonesError?.message ?? customersError?.message ?? "Error cargando zonas.",
    };
  }

  const customerCountByZone = new Map<string, number>();
  for (const customer of customersData ?? []) {
    const zoneId = customer.zone_id as string | null;
    if (!zoneId) continue;
    customerCountByZone.set(zoneId, (customerCountByZone.get(zoneId) ?? 0) + 1);
  }

  const rows: AdminZoneRow[] = (zonesData ?? []).map((row) => {
    const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
    const customerCount = customerCountByZone.get(row.id) ?? 0;
    const weeklyTarget = row.weekly_target ?? 225;

    let status = "OK";
    if (customerCount === 0) {
      status = "Sin clientes";
    } else if (customerCount > weeklyTarget) {
      status = "Sobrecarga";
    } else if (customerCount < Math.round(weeklyTarget * 0.6)) {
      status = "Liviana";
    }

    return {
      id: row.id,
      zoneCode: row.zone_code,
      zoneName: row.zone_name,
      vendorCode: vendor?.vendor_code ?? "Sin vendedor",
      vendorId: row.current_vendor_id ?? "",
      customerCount,
      weeklyTarget,
      status,
    };
  });

  return { connected: true, rows };
}

export async function getAdminVendors() {
  const supabase = getSupabaseOrNull();

  if (!supabase) {
    return { connected: false, rows: [] as AdminVendorRow[], errorMessage: "Supabase no configurado." };
  }

  const [{ data: vendorsData, error: vendorsError }, { data: zonesData, error: zonesError }, { data: customersData, error: customersError }] = await Promise.all([
    supabase.from("vendors").select("id,vendor_code,full_name,active").order("vendor_code", { ascending: true }),
    supabase.from("zones").select("current_vendor_id").eq("active", true),
    supabase.from("customers").select("assigned_vendor_id").eq("active", true),
  ]);

  if (vendorsError || zonesError || customersError) {
    return {
      connected: false,
      rows: [] as AdminVendorRow[],
      errorMessage: vendorsError?.message ?? zonesError?.message ?? customersError?.message ?? "Error cargando vendedores.",
    };
  }

  const zoneCountByVendor = new Map<string, number>();
  for (const zone of zonesData ?? []) {
    const vendorId = zone.current_vendor_id as string | null;
    if (!vendorId) continue;
    zoneCountByVendor.set(vendorId, (zoneCountByVendor.get(vendorId) ?? 0) + 1);
  }

  const customerCountByVendor = new Map<string, number>();
  for (const customer of customersData ?? []) {
    const vendorId = customer.assigned_vendor_id as string | null;
    if (!vendorId) continue;
    customerCountByVendor.set(vendorId, (customerCountByVendor.get(vendorId) ?? 0) + 1);
  }

  const rows: AdminVendorRow[] = (vendorsData ?? []).map((row) => {
    const customerCount = customerCountByVendor.get(row.id) ?? 0;

    return {
      id: row.id,
      vendorCode: row.vendor_code,
      fullName: row.full_name,
      zoneCount: zoneCountByVendor.get(row.id) ?? 0,
      customerCount,
      status: row.active ? "Activo" : "Inactivo",
    };
  });

  return { connected: true, rows };
}

export async function getAdminVisits(limit = 100) {
  const supabase = getSupabaseOrNull();

  if (!supabase) {
    return { connected: false, rows: [] as AdminVisitRow[], errorMessage: "Supabase no configurado." };
  }

  const { data, error } = await supabase
    .from("daily_visits")
    .select(
      `
        id,
        visit_date,
        status,
        comment,
        customers!daily_visits_customer_id_fkey(full_name),
        vendors!daily_visits_vendor_id_fkey(vendor_code)
      `,
    )
    .order("visit_date", { ascending: false })
    .order("planned_order", { ascending: true })
    .limit(limit);

  if (error) {
    return { connected: false, rows: [] as AdminVisitRow[], errorMessage: error.message };
  }

  const rows: AdminVisitRow[] = (data ?? []).map((row) => {
    const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;

    return {
      id: row.id,
      customerName: customer?.full_name ?? "Cliente sin nombre",
      vendorCode: vendor?.vendor_code ?? "Sin vendedor",
      visitDateLabel: row.visit_date ? formatDateLabel(row.visit_date) : "Sin fecha",
      status: visitStatusLabelMap[row.status as keyof typeof visitStatusLabelMap] ?? row.status,
      comment: row.comment?.trim() ? row.comment : "-",
    };
  });

  return { connected: true, rows };
}

export async function getAdminWeeklyPlanData(weekStartDate?: string) {
  const supabase = getSupabaseOrNull();
  const normalizedWeekStart = normalizeWeekStartDate(weekStartDate);
  const { weekStartDate: currentWeekStart, endDate, dayDates } = getWorkingWeekDateRange(normalizedWeekStart);

  if (!supabase) {
    return {
      connected: false,
      weekStartDate: currentWeekStart,
      weekLabel: formatWeekLabel(currentWeekStart),
      planStatus: "Sin conexion",
      totalVisits: 0,
      rows: [] as AdminWeeklyPlanRow[],
      errorMessage: "Supabase no configurado.",
    };
  }

  const [planRes, vendorsRes, summaryRes] = await Promise.all([
    supabase.from("weekly_plans").select("id,status").eq("week_start_date", currentWeekStart).maybeSingle(),
    supabase.from("vendors").select("id,vendor_code,full_name,active").eq("active", true).order("vendor_code", { ascending: true }),
    supabase
      .from("v_daily_visit_summary")
      .select("visit_date,vendor_id,total_visits")
      .gte("visit_date", currentWeekStart)
      .lte("visit_date", toIsoDate(endDate)),
  ]);

  const firstError = [planRes.error, vendorsRes.error, summaryRes.error].find(Boolean);

  if (firstError) {
    return {
      connected: false,
      weekStartDate: currentWeekStart,
      weekLabel: formatWeekLabel(currentWeekStart),
      planStatus: "Error",
      totalVisits: 0,
      rows: [] as AdminWeeklyPlanRow[],
      errorMessage: firstError.message,
    };
  }

  const vendorList = vendorsRes.data ?? [];
  const summaryMap = new Map<string, number>();

  for (const row of summaryRes.data ?? []) {
    const key = `${row.vendor_id}-${row.visit_date}`;
    summaryMap.set(key, row.total_visits ?? 0);
  }

  const rows: AdminWeeklyPlanRow[] = vendorList.map((vendor) => {
    const dayLoads = dayDates.map((date) => summaryMap.get(`${vendor.id}-${date}`) ?? 0);
    const total = dayLoads.reduce((sum, current) => sum + current, 0);
    const maxDay = Math.max(0, ...dayLoads);

    let status = "Sin plan";
    if (total > 0 && maxDay > 45) {
      status = "Sobrecarga";
    } else if (total > 0 && maxDay < 30) {
      status = "Liviano";
    } else if (total > 0) {
      status = "OK";
    }

    return {
      vendorId: vendor.id,
      vendorCode: vendor.vendor_code,
      fullName: vendor.full_name,
      dayLoads,
      total,
      status,
    };
  });

  const totalVisits = rows.reduce((sum, row) => sum + row.total, 0);

  return {
    connected: true,
    weekStartDate: currentWeekStart,
    weekLabel: formatWeekLabel(currentWeekStart),
    planStatus: planRes.data?.status ?? "Sin plan",
    totalVisits,
    rows,
  };
}
