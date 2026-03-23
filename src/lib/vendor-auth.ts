import { getVendorSession } from "@/lib/vendor-session";

export async function getCurrentVendorCode(rawVendorCode?: string) {
  if (rawVendorCode?.trim()) {
    return rawVendorCode.trim().toUpperCase();
  }

  const session = await getVendorSession();
  return session?.vendorCode ?? "";
}
