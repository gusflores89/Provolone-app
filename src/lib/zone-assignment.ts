import { createSupabaseAdminClient } from "@/lib/supabase";

type ZoneAssignmentSource = "admin" | "system";

export type ZoneRebalanceResult = {
  ok: boolean;
  message: string;
};

type ZoneWorkloadRow = {
  id: string;
  zone_code: string;
  zone_name: string;
  current_vendor_id: string | null;
  customer_count: number;
};

type VendorRow = {
  id: string;
  vendor_code: string;
  full_name: string;
};

async function applyZoneAssignment(params: {
  zoneId: string;
  newVendorId: string;
  previousVendorId: string | null;
  source: ZoneAssignmentSource;
}) {
  const { zoneId, newVendorId, previousVendorId, source } = params;
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const updateZoneRes = await supabase
    .from("zones")
    .update({ current_vendor_id: newVendorId })
    .eq("id", zoneId);

  if (updateZoneRes.error) {
    throw new Error(updateZoneRes.error.message);
  }

  const zoneDefaultCustomersRes = await supabase
    .from("customers")
    .select("id")
    .eq("zone_id", zoneId)
    .eq("assignment_mode", "zone_default");

  if (zoneDefaultCustomersRes.error) {
    throw new Error(zoneDefaultCustomersRes.error.message);
  }

  const customerIds = (zoneDefaultCustomersRes.data ?? []).map((row) => row.id);

  const updateDefaultVendorRes = await supabase
    .from("customers")
    .update({
      default_vendor_id: newVendorId,
      assigned_vendor_id: newVendorId,
    })
    .eq("zone_id", zoneId)
    .eq("assignment_mode", "zone_default");

  if (updateDefaultVendorRes.error) {
    throw new Error(updateDefaultVendorRes.error.message);
  }

  const updateManualDefaultRes = await supabase
    .from("customers")
    .update({ default_vendor_id: newVendorId })
    .eq("zone_id", zoneId)
    .eq("assignment_mode", "manual_override");

  if (updateManualDefaultRes.error) {
    throw new Error(updateManualDefaultRes.error.message);
  }

  if (customerIds.length > 0) {
    const updateVisitsRes = await supabase
      .from("daily_visits")
      .update({ vendor_id: newVendorId })
      .in("customer_id", customerIds)
      .eq("status", "pending")
      .gte("visit_date", today);

    if (updateVisitsRes.error) {
      throw new Error(updateVisitsRes.error.message);
    }
  }

  if (previousVendorId && previousVendorId !== newVendorId) {
    const closeHistoryRes = await supabase
      .from("zone_assignment_history")
      .update({ ends_on: today })
      .eq("zone_id", zoneId)
      .is("ends_on", null);

    if (closeHistoryRes.error) {
      throw new Error(closeHistoryRes.error.message);
    }
  }

  if (previousVendorId !== newVendorId) {
    const historyRes = await supabase.from("zone_assignment_history").insert({
      zone_id: zoneId,
      vendor_id: newVendorId,
      assignment_source: source,
      starts_on: today,
    });

    if (historyRes.error) {
      throw new Error(historyRes.error.message);
    }
  }
}

export async function assignZoneToVendor(zoneId: string, newVendorId: string): Promise<ZoneRebalanceResult> {
  const supabase = createSupabaseAdminClient();

  const zoneRes = await supabase
    .from("zones")
    .select("id,zone_name,current_vendor_id")
    .eq("id", zoneId)
    .maybeSingle();

  if (zoneRes.error || !zoneRes.data) {
    return {
      ok: false,
      message: zoneRes.error?.message ?? "No se encontro la zona a reasignar.",
    };
  }

  if (zoneRes.data.current_vendor_id === newVendorId) {
    return {
      ok: true,
      message: `La zona ${zoneRes.data.zone_name} ya estaba asignada a ese vendedor.`,
    };
  }

  const vendorRes = await supabase
    .from("vendors")
    .select("id,full_name,vendor_code")
    .eq("id", newVendorId)
    .maybeSingle();

  if (vendorRes.error || !vendorRes.data) {
    return {
      ok: false,
      message: vendorRes.error?.message ?? "No se encontro el vendedor seleccionado.",
    };
  }

  try {
    await applyZoneAssignment({
      zoneId,
      newVendorId,
      previousVendorId: zoneRes.data.current_vendor_id,
      source: "admin",
    });

    return {
      ok: true,
      message: `Zona ${zoneRes.data.zone_name} reasignada a ${vendorRes.data.full_name} (${vendorRes.data.vendor_code}).`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo reasignar la zona.",
    };
  }
}

export async function rebalanceZonesAcrossVendors(): Promise<ZoneRebalanceResult> {
  const supabase = createSupabaseAdminClient();

  const [vendorsRes, zonesRes, customerCountsRes] = await Promise.all([
    supabase.from("vendors").select("id,vendor_code,full_name").eq("active", true).order("vendor_code", { ascending: true }),
    supabase.from("zones").select("id,zone_code,zone_name,current_vendor_id").eq("active", true).order("zone_code", { ascending: true }),
    supabase.from("customers").select("zone_id").eq("active", true),
  ]);

  const firstError = [vendorsRes.error, zonesRes.error, customerCountsRes.error].find(Boolean);
  if (firstError) {
    return { ok: false, message: firstError.message };
  }

  const vendors = (vendorsRes.data ?? []) as VendorRow[];
  if (vendors.length === 0) {
    return { ok: false, message: "No hay vendedores activos para rebalancear zonas." };
  }

  const customerCountByZone = new Map<string, number>();
  for (const row of customerCountsRes.data ?? []) {
    const zoneId = row.zone_id as string | null;
    if (!zoneId) continue;
    customerCountByZone.set(zoneId, (customerCountByZone.get(zoneId) ?? 0) + 1);
  }

  const zones: ZoneWorkloadRow[] = ((zonesRes.data ?? []) as Array<ZoneWorkloadRow>).map((zone) => ({
    id: zone.id,
    zone_code: zone.zone_code,
    zone_name: zone.zone_name,
    current_vendor_id: zone.current_vendor_id,
    customer_count: customerCountByZone.get(zone.id) ?? 0,
  }));

  const loadByVendor = new Map<string, number>();
  for (const vendor of vendors) {
    loadByVendor.set(vendor.id, 0);
  }

  const desiredAssignments = new Map<string, string>();
  const zonesSorted = [...zones].sort((a, b) => {
    if (b.customer_count !== a.customer_count) {
      return b.customer_count - a.customer_count;
    }
    return a.zone_code.localeCompare(b.zone_code, "es");
  });

  for (const zone of zonesSorted) {
    const selectedVendor = [...vendors].sort((left, right) => {
      const loadDiff = (loadByVendor.get(left.id) ?? 0) - (loadByVendor.get(right.id) ?? 0);
      if (loadDiff !== 0) {
        return loadDiff;
      }
      return left.vendor_code.localeCompare(right.vendor_code, "es");
    })[0];

    desiredAssignments.set(zone.id, selectedVendor.id);
    loadByVendor.set(selectedVendor.id, (loadByVendor.get(selectedVendor.id) ?? 0) + zone.customer_count);
  }

  const changedZones = zones.filter((zone) => desiredAssignments.get(zone.id) !== zone.current_vendor_id);

  for (const zone of changedZones) {
    await applyZoneAssignment({
      zoneId: zone.id,
      newVendorId: desiredAssignments.get(zone.id)!,
      previousVendorId: zone.current_vendor_id,
      source: "system",
    });
  }

  return {
    ok: true,
    message:
      changedZones.length === 0
        ? "Las zonas ya estaban balanceadas con la configuracion actual."
        : `Se rebalancearon ${changedZones.length} zonas entre ${vendors.length} vendedores.`,
  };
}
