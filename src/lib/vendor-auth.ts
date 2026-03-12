import { getVendorSession } from "@/lib/vendor-session";

export const DEFAULT_VENDOR_CODE = "V001";

export async function getCurrentVendorCode(rawVendorCode?: string) {
  if (rawVendorCode?.trim()) {
    return rawVendorCode.trim().toUpperCase();
  }

  const session = await getVendorSession();
  return session?.vendorCode ?? DEFAULT_VENDOR_CODE;
}
