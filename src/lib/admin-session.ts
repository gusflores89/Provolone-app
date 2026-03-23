import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAppSessionSecret } from "@/lib/env";

const ADMIN_SESSION_COOKIE = "admin_session";

type AdminSessionPayload = {
  email: string;
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

function encodeAdminSession(payload: AdminSessionPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function decodeAdminSession(token: string): AdminSessionPayload | null {
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
    return JSON.parse(base64UrlDecode(encodedPayload)) as AdminSessionPayload;
  } catch {
    return null;
  }
}

export async function createAdminSession(payload: AdminSessionPayload) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, encodeAdminSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return decodeAdminSession(token);
}
