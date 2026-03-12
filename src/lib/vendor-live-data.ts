import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase";

export const DEFAULT_VENDOR_CODE = "V001";

const statusLabelMap = {
  pending: "Pendiente",
  visited_with_order: "Visitado con pedido",
  visited_without_order: "Visitado sin pedido",
  rescheduled: "Reprogramado",
  not_visited: "No visitado",
  cancelled: "Cancelado",
} as const;

type VisitRow = {
  id: string;
  customer_id: string;
  planned_order: number | null;
  status: string;
  visit_date?: string;
  comment?: string | null;
  rescheduled_to?: string | null;
  customers:
    | {
        full_name: string | null;
        address_line: string | null;
        phone: string | null;
        notes: string | null;
      }
    | null
    | Array<{
        full_name: string | null;
        address_line: string | null;
        phone: string | null;
        notes: string | null;
      }>;
  zones:
    | {
        zone_name: string | null;
      }
    | null
    | Array<{
        zone_name: string | null;
      }>;
};

export type VendorVisit = {
  id: string;
  customerId: string;
  customerName: string;
  address: string;
  zone: string;
  phone: string;
  notes: string;
  status: string;
  order: number;
  mapsUrl: string;
};

export type VendorSummary = {
  code: string;
  name: string;
};

export type VendorVisitDetail = VendorVisit & {
  comment?: string;
  rescheduledTo?: string;
};

export function resolveVendorCode(rawVendorCode?: string) {
  return rawVendorCode?.trim().toUpperCase() || DEFAULT_VENDOR_CODE;
}

function buildMapsUrl(address: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(`${address}, Cordoba`)}`;
}

function mapVisitRow(row: VisitRow): VendorVisit {
  const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
  const zone = Array.isArray(row.zones) ? row.zones[0] : row.zones;

  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: customer?.full_name ?? "Cliente sin nombre",
    address: customer?.address_line ?? "Direccion sin cargar",
    zone: zone?.zone_name ?? "Zona sin nombre",
    phone: customer?.phone ?? "",
    notes: customer?.notes ?? "",
    status: statusLabelMap[row.status as keyof typeof statusLabelMap] ?? row.status,
    order: row.planned_order ?? 0,
    mapsUrl: buildMapsUrl(customer?.address_line ?? "Cordoba"),
  };
}

async function fetchVisitsForDate(supabase: ReturnType<typeof createSupabaseServerClient>, vendorId: string, visitDate: string) {
  return supabase
    .from("daily_visits")
    .select(
      `
        id,
        customer_id,
        planned_order,
        status,
        visit_date,
        customers!daily_visits_customer_id_fkey(full_name,address_line,phone,notes),
        zones!daily_visits_zone_id_fkey(zone_name)
      `,
    )
    .eq("vendor_id", vendorId)
    .eq("visit_date", visitDate)
    .order("planned_order", { ascending: true });
}

export async function getVendorTodayData(rawVendorCode?: string) {
  const vendorCode = resolveVendorCode(rawVendorCode);
  const today = new Date().toISOString().slice(0, 10);

  if (!hasSupabaseEnv()) {
    return {
      connected: false,
      vendor: {
        code: vendorCode,
        name: "Sin conexion",
      },
      visits: [] as VendorVisit[],
      effectiveDate: today,
      usingFallbackDate: false,
      errorMessage: "Supabase no esta configurado todavia.",
    };
  }

  const supabase = createSupabaseServerClient();

  const { data: vendorRow, error: vendorError } = await supabase
    .from("vendors")
    .select("id,vendor_code,full_name")
    .eq("vendor_code", vendorCode)
    .maybeSingle();

  if (vendorError || !vendorRow) {
    return {
      connected: true,
      vendor: {
        code: vendorCode,
        name: "Vendedor no encontrado",
      },
      visits: [] as VendorVisit[],
      effectiveDate: today,
      usingFallbackDate: false,
      errorMessage: vendorError?.message ?? `No existe el vendedor ${vendorCode}.`,
    };
  }

  const todayRes = await fetchVisitsForDate(supabase, vendorRow.id, today);

  if (todayRes.error) {
    return {
      connected: true,
      vendor: {
        code: vendorRow.vendor_code,
        name: vendorRow.full_name,
      },
      visits: [] as VendorVisit[],
      effectiveDate: today,
      usingFallbackDate: false,
      errorMessage: todayRes.error.message,
    };
  }

  let effectiveDate = today;
  let usingFallbackDate = false;
  let visitRows = todayRes.data ?? [];

  if (visitRows.length === 0) {
    const latestRes = await supabase
      .from("daily_visits")
      .select("visit_date")
      .eq("vendor_id", vendorRow.id)
      .order("visit_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRes.data?.visit_date) {
      const fallbackDate = latestRes.data.visit_date;
      const fallbackRes = await fetchVisitsForDate(supabase, vendorRow.id, fallbackDate);

      if (!fallbackRes.error) {
        visitRows = fallbackRes.data ?? [];
        effectiveDate = fallbackDate;
        usingFallbackDate = fallbackDate !== today;
      }
    }
  }

  const visits: VendorVisit[] = visitRows.map((row) => mapVisitRow(row as VisitRow));

  return {
    connected: true,
    vendor: {
      code: vendorRow.vendor_code,
      name: vendorRow.full_name,
    },
    visits,
    effectiveDate,
    usingFallbackDate,
  };
}

export async function getVendorVisitDetail(
  visitId: string,
  rawVendorCode?: string,
): Promise<{
  connected: boolean;
  vendor: VendorSummary;
  visit: VendorVisitDetail | null;
  errorMessage?: string;
}> {
  const vendorCode = resolveVendorCode(rawVendorCode);

  if (!hasSupabaseEnv()) {
    return {
      connected: false,
      vendor: {
        code: vendorCode,
        name: "Sin conexion",
      },
      visit: null,
      errorMessage: "Supabase no esta configurado todavia.",
    };
  }

  const supabase = createSupabaseServerClient();

  const { data: vendorRow, error: vendorError } = await supabase
    .from("vendors")
    .select("id,vendor_code,full_name")
    .eq("vendor_code", vendorCode)
    .maybeSingle();

  if (vendorError || !vendorRow) {
    return {
      connected: true,
      vendor: {
        code: vendorCode,
        name: "Vendedor no encontrado",
      },
      visit: null,
      errorMessage: vendorError?.message ?? `No existe el vendedor ${vendorCode}.`,
    };
  }

  const { data: row, error } = await supabase
    .from("daily_visits")
    .select(
      `
        id,
        customer_id,
        planned_order,
        status,
        comment,
        rescheduled_to,
        customers!daily_visits_customer_id_fkey(full_name,address_line,phone,notes),
        zones!daily_visits_zone_id_fkey(zone_name)
      `,
    )
    .eq("id", visitId)
    .eq("vendor_id", vendorRow.id)
    .maybeSingle();

  if (error || !row) {
    return {
      connected: true,
      vendor: {
        code: vendorRow.vendor_code,
        name: vendorRow.full_name,
      },
      visit: null,
      errorMessage: error?.message ?? "No se encontro la visita solicitada.",
    };
  }

  const visit = mapVisitRow(row as VisitRow);

  return {
    connected: true,
    vendor: {
      code: vendorRow.vendor_code,
      name: vendorRow.full_name,
    },
    visit: {
      ...visit,
      comment: row.comment ?? "",
      rescheduledTo: row.rescheduled_to ?? "",
    },
  };
}

export function getStatusCounts(visits: VendorVisit[]) {
  return {
    total: visits.length,
    pending: visits.filter((visit) => visit.status === "Pendiente").length,
    visited: visits.filter((visit) => visit.status.startsWith("Visitado")).length,
    rescheduled: visits.filter((visit) => visit.status === "Reprogramado").length,
  };
}
