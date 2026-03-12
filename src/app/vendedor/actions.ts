"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createVendorSession } from "@/lib/vendor-session";

export type VendorLoginState = {
  error?: string;
};

export async function vendorLoginAction(
  _prevState: VendorLoginState,
  formData: FormData,
): Promise<VendorLoginState> {
  const vendorCode = String(formData.get("vendorCode") ?? "").trim().toUpperCase();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!vendorCode || !pin) {
    return { error: "Completá codigo y PIN." };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("verify_vendor_login", {
    p_vendor_code: vendorCode,
    p_pin: pin,
  });

  if (error) {
    return { error: `No pudimos validar el acceso: ${error.message}` };
  }

  const vendor = Array.isArray(data) ? data[0] : null;

  if (!vendor) {
    return { error: "Codigo o PIN incorrecto." };
  }

  await createVendorSession({
    vendorCode: vendor.vendor_code,
    vendorName: vendor.full_name,
  });

  redirect("/vendedor/hoy");
}

export async function vendorLogoutAction() {
  const { clearVendorSession } = await import("@/lib/vendor-session");
  await clearVendorSession();
  redirect("/vendedor/ingresar");
}
