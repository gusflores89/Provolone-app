import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase";

const WORKING_DAY_COUNT = 5;
const PAGE_SIZE = 1000;
const ROUTE_START_LAT = -31.4172;
const ROUTE_START_LNG = -64.1865;

type WeeklyVisitSeedRow = {
  customer_id: string;
  vendor_id: string;
  visit_date: string;
  planned_order: number | null;
};

type WeeklyCustomerRow = {
  id: string;
  full_name: string;
  zone_id: string | null;
  assigned_vendor_id: string | null;
  active: boolean;
  lat: number | string | null;
  lng: number | string | null;
};

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

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const result = await fetchPage(from, to);
    if (result.error) {
      throw new Error(result.error.message);
    }

    const page = result.data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
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

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function toNumericCoordinate(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function squaredDistance(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const dLat = fromLat - toLat;
  const dLng = fromLng - toLng;
  return dLat * dLat + dLng * dLng;
}

function selectGeoSeeds(customers: Array<WeeklyCustomerRow & { lat: number; lng: number }>, clusterCount: number) {
  if (customers.length === 0 || clusterCount <= 0) {
    return [] as Array<{ lat: number; lng: number }>;
  }

  const sorted = [...customers].sort((left, right) => left.lat - right.lat || left.lng - right.lng);
  const seeds = [sorted[0]];

  while (seeds.length < clusterCount && seeds.length < sorted.length) {
    let bestCustomer = sorted[0];
    let bestDistance = Number.NEGATIVE_INFINITY;

    for (const customer of sorted) {
      const minDistance = Math.min(
        ...seeds.map((seed) => squaredDistance(customer.lat, customer.lng, seed.lat, seed.lng)),
      );

      if (minDistance > bestDistance) {
        bestDistance = minDistance;
        bestCustomer = customer;
      }
    }

    seeds.push(bestCustomer);
  }

  return seeds.slice(0, clusterCount).map((seed) => ({ lat: seed.lat, lng: seed.lng }));
}

function buildBalancedGeoClusters(customers: WeeklyCustomerRow[], clusterCount: number) {
  const normalizedCustomers = customers
    .map((customer) => ({
      ...customer,
      lat: toNumericCoordinate(customer.lat),
      lng: toNumericCoordinate(customer.lng),
    }))
    .filter((customer): customer is WeeklyCustomerRow & { lat: number; lng: number } =>
      typeof customer.lat === "number" && typeof customer.lng === "number",
    );

  if (normalizedCustomers.length === 0 || clusterCount <= 0) {
    return [] as Array<Array<WeeklyCustomerRow & { lat: number; lng: number }>>;
  }

  const effectiveClusterCount = Math.min(clusterCount, normalizedCustomers.length);
  const capacities = Array.from({ length: effectiveClusterCount }, (_, index) => {
    const base = Math.floor(normalizedCustomers.length / effectiveClusterCount);
    const extra = index < normalizedCustomers.length % effectiveClusterCount ? 1 : 0;
    return base + extra;
  });

  let centers = selectGeoSeeds(normalizedCustomers, effectiveClusterCount);

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const rankedCustomers = normalizedCustomers
      .map((customer) => {
        const orderedChoices = centers
          .map((center, index) => ({
            index,
            distance: squaredDistance(customer.lat, customer.lng, center.lat, center.lng),
          }))
          .sort((left, right) => left.distance - right.distance);

        return {
          customer,
          orderedChoices,
          margin:
            (orderedChoices[1]?.distance ?? orderedChoices[0]?.distance ?? 0) -
            (orderedChoices[0]?.distance ?? 0),
        };
      })
      .sort((left, right) => right.margin - left.margin);

    const clusters = Array.from({ length: effectiveClusterCount }, () => [] as Array<WeeklyCustomerRow & { lat: number; lng: number }>);

    for (const ranked of rankedCustomers) {
      const choice = ranked.orderedChoices.find((option) => clusters[option.index].length < capacities[option.index]);
      const fallbackChoice = choice ?? ranked.orderedChoices[0];
      clusters[fallbackChoice.index].push(ranked.customer);
    }

    centers = clusters.map((cluster, index) => {
      if (cluster.length === 0) {
        return centers[index];
      }

      return {
        lat: cluster.reduce((sum, customer) => sum + customer.lat, 0) / cluster.length,
        lng: cluster.reduce((sum, customer) => sum + customer.lng, 0) / cluster.length,
      };
    });
  }

  const finalRankedCustomers = normalizedCustomers
    .map((customer) => {
      const orderedChoices = centers
        .map((center, index) => ({
          index,
          distance: squaredDistance(customer.lat, customer.lng, center.lat, center.lng),
        }))
        .sort((left, right) => left.distance - right.distance);

      return {
        customer,
        orderedChoices,
        margin:
          (orderedChoices[1]?.distance ?? orderedChoices[0]?.distance ?? 0) -
          (orderedChoices[0]?.distance ?? 0),
      };
    })
    .sort((left, right) => right.margin - left.margin);

  const clusters = Array.from({ length: effectiveClusterCount }, () => [] as Array<WeeklyCustomerRow & { lat: number; lng: number }>);

  for (const ranked of finalRankedCustomers) {
    const choice = ranked.orderedChoices.find((option) => clusters[option.index].length < capacities[option.index]);
    const fallbackChoice = choice ?? ranked.orderedChoices[0];
    clusters[fallbackChoice.index].push(ranked.customer);
  }

  return clusters;
}

function assignCustomersToDays(
  customers: WeeklyCustomerRow[],
  dayDates: string[],
  existingDayLoads: number[],
) {
  const customersWithCoords = customers.filter((customer) => {
    const lat = toNumericCoordinate(customer.lat);
    const lng = toNumericCoordinate(customer.lng);
    return lat !== null && lng !== null;
  });
  const customersWithoutCoords = customers.filter((customer) => {
    const lat = toNumericCoordinate(customer.lat);
    const lng = toNumericCoordinate(customer.lng);
    return lat === null || lng === null;
  });

  const clusters = buildBalancedGeoClusters(customersWithCoords, dayDates.length);
  const assignments = new Map<string, WeeklyCustomerRow[]>();
  const currentLoads = [...existingDayLoads];

  for (const date of dayDates) {
    assignments.set(date, []);
  }

  const sortedClusters = [...clusters].sort((left, right) => right.length - left.length);

  for (const cluster of sortedClusters) {
    let targetDayIndex = 0;
    let targetDayLoad = Number.POSITIVE_INFINITY;

    for (let index = 0; index < dayDates.length; index += 1) {
      if (currentLoads[index] < targetDayLoad) {
        targetDayLoad = currentLoads[index];
        targetDayIndex = index;
      }
    }

    const visitDate = dayDates[targetDayIndex];
    const list = assignments.get(visitDate) ?? [];
    list.push(...cluster);
    assignments.set(visitDate, list);
    currentLoads[targetDayIndex] += cluster.length;
  }

  for (const customer of customersWithoutCoords) {
    let targetDayIndex = 0;
    let targetDayLoad = Number.POSITIVE_INFINITY;

    for (let index = 0; index < dayDates.length; index += 1) {
      if (currentLoads[index] < targetDayLoad) {
        targetDayLoad = currentLoads[index];
        targetDayIndex = index;
      }
    }

    const visitDate = dayDates[targetDayIndex];
    const list = assignments.get(visitDate) ?? [];
    list.push(customer);
    assignments.set(visitDate, list);
    currentLoads[targetDayIndex] += 1;
  }

  return assignments;
}

function orderCustomersByNearestNeighbor(customers: WeeklyCustomerRow[]) {
  const normalizedCustomers = customers.map((customer) => ({
    ...customer,
    lat: toNumericCoordinate(customer.lat),
    lng: toNumericCoordinate(customer.lng),
  }));

  const customersWithCoords = normalizedCustomers.filter(
    (customer) => typeof customer.lat === "number" && typeof customer.lng === "number",
  );
  const customersWithoutCoords = normalizedCustomers.filter(
    (customer) => typeof customer.lat !== "number" || typeof customer.lng !== "number",
  );

  if (customersWithCoords.length <= 1) {
    return [...customersWithCoords, ...customersWithoutCoords];
  }

  const pending = [...customersWithCoords];
  const ordered: WeeklyCustomerRow[] = [];
  let currentLat = ROUTE_START_LAT;
  let currentLng = ROUTE_START_LNG;

  while (pending.length > 0) {
    let selectedIndex = 0;
    let selectedDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < pending.length; index += 1) {
      const candidate = pending[index];
      const distance = haversineDistanceKm(currentLat, currentLng, candidate.lat!, candidate.lng!);

      if (distance < selectedDistance) {
        selectedDistance = distance;
        selectedIndex = index;
      }
    }

    const [selectedCustomer] = pending.splice(selectedIndex, 1);
    ordered.push(selectedCustomer);
    currentLat = selectedCustomer.lat!;
    currentLng = selectedCustomer.lng!;
  }

  return [...ordered, ...customersWithoutCoords];
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

  try {
    const [existingVisits, customers] = await Promise.all([
      fetchAllRows<WeeklyVisitSeedRow>(async (from, to) =>
        await supabase
          .from("daily_visits")
          .select("customer_id,vendor_id,visit_date,planned_order")
          .gte("visit_date", weekStartDate)
          .lte("visit_date", weekEndDate)
          .range(from, to),
      ),
      fetchAllRows<WeeklyCustomerRow>(async (from, to) =>
        await supabase
          .from("customers")
          .select("id,full_name,zone_id,assigned_vendor_id,active,lat,lng")
          .eq("active", true)
          .order("assigned_vendor_id", { ascending: true })
          .order("zone_id", { ascending: true })
          .order("full_name", { ascending: true })
          .range(from, to),
      ),
    ]);

    if (customers.length === 0) {
      return { ok: false, message: "No hay clientes activos para generar visitas." };
    }

    const existingCustomerIds = new Set(existingVisits.map((visit) => visit.customer_id));
    const orderCounterByVendorDay = new Map<string, number>();
    const existingVisitCountByVendorDay = new Map<string, number>();

    for (const visit of existingVisits) {
      const key = `${visit.vendor_id}-${visit.visit_date}`;
      const currentOrder = visit.planned_order ?? 0;
      orderCounterByVendorDay.set(key, Math.max(orderCounterByVendorDay.get(key) ?? 0, currentOrder));
      existingVisitCountByVendorDay.set(key, (existingVisitCountByVendorDay.get(key) ?? 0) + 1);
    }

    const groupedCustomers = new Map<string, WeeklyCustomerRow[]>();
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
      const existingDayLoads = dayDates.map(
        (visitDate) => existingVisitCountByVendorDay.get(`${vendorId}-${visitDate}`) ?? 0,
      );
      const customersByDay = assignCustomersToDays(vendorCustomers, dayDates, existingDayLoads);

      for (const visitDate of dayDates) {
        const dayCustomers = customersByDay.get(visitDate) ?? [];
        const orderedDayCustomers = orderCustomersByNearestNeighbor(dayCustomers);

        orderedDayCustomers.forEach((customer) => {
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
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo generar el plan semanal.",
    };
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
    message: `Plan semanal actualizado. Se agregaron visitas nuevas entre ${formatIsoDateForAr(weekStartDate)} y ${formatIsoDateForAr(weekEndDate)}.`,
  };
}
