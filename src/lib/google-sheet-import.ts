import { hasGoogleSheetsImportEnv } from "@/lib/env";
import { readGoogleSheetTabs, type SheetRow } from "@/lib/google-sheets";
import { createSupabaseAdminClient } from "@/lib/supabase";

const REQUIRED_TABS = ["VENDEDORES", "ZONAS", "CLIENTES"] as const;

type SyncIssue = {
  entityType: string;
  entityKey: string;
  issueMessage: string;
  payload?: Record<string, unknown>;
};

function pickFirst(row: SheetRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim() !== "") {
      return value.trim();
    }
  }
  return "";
}

function parseBoolean(value: string, fallback = true) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return ["true", "1", "si", "s", "yes", "y"].includes(normalized);
}

function parseNumber(value: string, fallback: number | null = null) {
  if (!value.trim()) return fallback;
  const normalized = value.replace(/,/g, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type GoogleSheetImportResult = {
  ok: boolean;
  message: string;
};

export async function runGoogleSheetImport(): Promise<GoogleSheetImportResult> {
  if (!hasGoogleSheetsImportEnv()) {
    return {
      ok: false,
      message:
        "Faltan variables para importar desde Google Sheets. Necesitas spreadsheet id, service account y service role key.",
    };
  }

  const supabase = createSupabaseAdminClient();
  const syncIssues: SyncIssue[] = [];

  const startRun = await supabase
    .from("sync_runs")
    .insert({
      source_name: "google_sheets_master",
      direction: "sheet_to_db",
      status: "running",
    })
    .select("id")
    .single();

  if (startRun.error || !startRun.data) {
    return {
      ok: false,
      message: `No pudimos iniciar el registro de sincronizacion: ${startRun.error?.message ?? "sin respuesta"}`,
    };
  }

  const syncRunId = startRun.data.id;

  try {
    const tabs = await readGoogleSheetTabs([...REQUIRED_TABS]);

    const vendorsRows = tabs.VENDEDORES ?? [];
    const zonesRows = tabs.ZONAS ?? [];
    const customersRows = tabs.CLIENTES ?? [];

    if (!vendorsRows.length || !zonesRows.length || !customersRows.length) {
      throw new Error("El sheet debe tener datos en VENDEDORES, ZONAS y CLIENTES.");
    }

    let processedVendors = 0;
    for (const row of vendorsRows) {
      const vendorCode = pickFirst(row, ["vendor_code", "codigo", "codigo_vendedor"]);
      const fullName = pickFirst(row, ["full_name", "nombre", "nombre_vendedor"]);

      if (!vendorCode) {
        syncIssues.push({
          entityType: "vendor",
          entityKey: "sin_codigo",
          issueMessage: "Fila de vendedor sin vendor_code.",
          payload: row,
        });
        continue;
      }

      const rpcResult = await supabase.rpc("upsert_vendor_from_import", {
        p_vendor_code: vendorCode,
        p_full_name: fullName || vendorCode,
        p_phone: pickFirst(row, ["phone", "telefono"]),
        p_active: parseBoolean(pickFirst(row, ["active", "activo"]), true),
        p_notes: pickFirst(row, ["notes", "notas"]),
        p_default_pin: process.env.IMPORT_DEFAULT_VENDOR_PIN || "1234",
      });

      if (rpcResult.error) {
        syncIssues.push({
          entityType: "vendor",
          entityKey: vendorCode,
          issueMessage: rpcResult.error.message,
          payload: row,
        });
        continue;
      }

      processedVendors += 1;
    }

    const vendorCodes = vendorsRows
      .map((row) => pickFirst(row, ["vendor_code", "codigo", "codigo_vendedor"]).toUpperCase())
      .filter(Boolean);

    const vendorsRes = await supabase
      .from("vendors")
      .select("id,vendor_code")
      .in("vendor_code", vendorCodes);

    if (vendorsRes.error) {
      throw new Error(vendorsRes.error.message);
    }

    const vendorMap = new Map((vendorsRes.data ?? []).map((vendor) => [vendor.vendor_code.toUpperCase(), vendor.id]));

    const zonePayload = [] as Array<{
      zone_code: string;
      zone_name: string;
      current_vendor_id: string | null;
      weekly_target: number;
      active: boolean;
    }>;

    for (const row of zonesRows) {
      const zoneCode = pickFirst(row, ["zone_code", "codigo_zona", "zona_code", "zona"]);
      const zoneName = pickFirst(row, ["zone_name", "nombre_zona", "nombre"]);
      const vendorCode = pickFirst(row, ["vendor_code", "codigo_vendedor", "vendedor_codigo"]).toUpperCase();

      if (!zoneCode || !zoneName) {
        syncIssues.push({
          entityType: "zone",
          entityKey: zoneCode || "sin_codigo",
          issueMessage: "Fila de zona sin zone_code o zone_name.",
          payload: row,
        });
        continue;
      }

      zonePayload.push({
        zone_code: zoneCode.toUpperCase(),
        zone_name: zoneName,
        current_vendor_id: vendorCode ? vendorMap.get(vendorCode) ?? null : null,
        weekly_target: parseNumber(pickFirst(row, ["weekly_target", "objetivo_semanal"]), 225) ?? 225,
        active: parseBoolean(pickFirst(row, ["active", "activo"]), true),
      });
    }

    const zonesUpsertRes = await supabase.from("zones").upsert(zonePayload, {
      onConflict: "zone_code",
      ignoreDuplicates: false,
    });

    if (zonesUpsertRes.error) {
      throw new Error(zonesUpsertRes.error.message);
    }

    const zoneCodes = zonePayload.map((zone) => zone.zone_code);
    const zonesRes = await supabase
      .from("zones")
      .select("id,zone_code,zone_name,current_vendor_id")
      .in("zone_code", zoneCodes);

    if (zonesRes.error) {
      throw new Error(zonesRes.error.message);
    }

    const zonesByCode = new Map((zonesRes.data ?? []).map((zone) => [zone.zone_code.toUpperCase(), zone]));
    const zonesByName = new Map((zonesRes.data ?? []).map((zone) => [zone.zone_name.toUpperCase(), zone]));

    const customerPayload = [] as Array<Record<string, unknown>>;

    for (const row of customersRows) {
      const externalCustomerId = pickFirst(row, ["external_customer_id", "cliente_id"]);
      const fullName = pickFirst(row, ["full_name", "nombre_cliente", "nombre"]);
      const addressLine = pickFirst(row, ["address_line", "direccion"]);
      const zoneCodeRaw = pickFirst(row, ["zone_code", "codigo_zona"]);
      const zoneNameRaw = pickFirst(row, ["zone_name", "zona"]);
      const overrideVendorCode = pickFirst(row, ["assigned_vendor_code_override", "vendor_override", "vendedor_override"]).toUpperCase();

      const zone = zoneCodeRaw
        ? zonesByCode.get(zoneCodeRaw.toUpperCase())
        : zoneNameRaw
          ? zonesByName.get(zoneNameRaw.toUpperCase())
          : undefined;

      if (!externalCustomerId || !fullName || !addressLine || !zone) {
        syncIssues.push({
          entityType: "customer",
          entityKey: externalCustomerId || "sin_id",
          issueMessage: "Fila de cliente incompleta o zona no encontrada.",
          payload: row,
        });
        continue;
      }

      const overrideVendorId = overrideVendorCode ? vendorMap.get(overrideVendorCode) ?? null : null;
      const assignedVendorId = overrideVendorId ?? zone.current_vendor_id;

      if (!assignedVendorId) {
        syncIssues.push({
          entityType: "customer",
          entityKey: externalCustomerId,
          issueMessage: "La zona del cliente no tiene vendedor asignado.",
          payload: row,
        });
        continue;
      }

      customerPayload.push({
        external_customer_id: externalCustomerId,
        full_name: fullName,
        address_line: addressLine,
        city: pickFirst(row, ["city", "ciudad"]) || "Cordoba",
        zone_id: zone.id,
        default_vendor_id: zone.current_vendor_id,
        assigned_vendor_id: assignedVendorId,
        assignment_mode: overrideVendorId ? "manual_override" : "zone_default",
        lat: parseNumber(pickFirst(row, ["lat"])),
        lng: parseNumber(pickFirst(row, ["lng"])),
        phone: pickFirst(row, ["phone", "telefono"]),
        notes: pickFirst(row, ["notes", "notas"]),
        active: parseBoolean(pickFirst(row, ["active", "activo"]), true),
        visit_frequency_days: parseNumber(pickFirst(row, ["visit_frequency_days", "frecuencia_dias"]), 7) ?? 7,
        next_visit_date: pickFirst(row, ["next_visit_date", "proxima_visita"]) || null,
      });
    }

    const customersUpsertRes = await supabase.from("customers").upsert(customerPayload, {
      onConflict: "external_customer_id",
      ignoreDuplicates: false,
    });

    if (customersUpsertRes.error) {
      throw new Error(customersUpsertRes.error.message);
    }

    if (syncIssues.length > 0) {
      await supabase.from("sync_issues").insert(
        syncIssues.map((issue) => ({
          sync_run_id: syncRunId,
          entity_type: issue.entityType,
          entity_key: issue.entityKey,
          issue_message: issue.issueMessage,
          payload: issue.payload ?? null,
        })),
      );
    }

    await supabase
      .from("sync_runs")
      .update({
        status: syncIssues.length > 0 ? "warning" : "success",
        finished_at: new Date().toISOString(),
        inserted_count: processedVendors + zonePayload.length + customerPayload.length,
        updated_count: 0,
        skipped_count: syncIssues.length,
        error_count: syncIssues.length,
        summary: {
          vendors_processed: processedVendors,
          zones_processed: zonePayload.length,
          customers_processed: customerPayload.length,
          issues: syncIssues.length,
        },
      })
      .eq("id", syncRunId);

    return {
      ok: true,
      message: `Importacion completa. Vendors: ${processedVendors}, zonas: ${zonePayload.length}, clientes: ${customerPayload.length}.`,
    };
  } catch (error) {
    await supabase
      .from("sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_count: syncIssues.length + 1,
        summary: {
          error: error instanceof Error ? error.message : "Error desconocido",
          issues: syncIssues.length,
        },
      })
      .eq("id", syncRunId);

    if (syncIssues.length > 0) {
      await supabase.from("sync_issues").insert(
        syncIssues.map((issue) => ({
          sync_run_id: syncRunId,
          entity_type: issue.entityType,
          entity_key: issue.entityKey,
          issue_message: issue.issueMessage,
          payload: issue.payload ?? null,
        })),
      );
    }

    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error desconocido al importar desde Google Sheets.",
    };
  }
}

export async function getSyncOverview() {
  if (!hasGoogleSheetsImportEnv()) {
    return {
      configured: false,
      syncRuns: [],
      message:
        "Faltan GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY o SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sync_runs")
    .select("id,started_at,finished_at,status,inserted_count,updated_count,error_count")
    .order("started_at", { ascending: false })
    .limit(10);

  if (error) {
    return {
      configured: true,
      syncRuns: [],
      message: error.message,
    };
  }

  return {
    configured: true,
    syncRuns: data ?? [],
    message: "Configuracion lista para importar desde Google Sheets.",
  };
}
