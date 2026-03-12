import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAppSessionSecret } from "@/lib/env";

const VENDOR_SESSION_COOKIE = "vendor_session";

type VendorSessionPayload = {
  vendorCode: string;
  vendorName: string;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value: string) {
  return createHmac("sha256", getAppSessionSecret()).update(value).digest("base64url");
}

function encodeVendorSession(payload: VendorSessionPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function decodeVendorSession(token: string): VendorSessionPayload | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = signValue(encodedPayload);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  try {
    return JSON.parse(base64UrlDecode(encodedPayload)) as VendorSessionPayload;
  } catch {
    return null;
  }
}

export async function createVendorSession(payload: VendorSessionPayload) {
  const cookieStore = await cookies();
  cookieStore.set(VENDOR_SESSION_COOKIE, encodeVendorSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearVendorSession() {
  const cookieStore = await cookies();
  cookieStore.delete(VENDOR_SESSION_COOKIE);
}

export async function getVendorSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(VENDOR_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return decodeVendorSession(token);
}
