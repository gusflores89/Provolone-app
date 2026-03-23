export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return { url, anonKey };
}

export function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }

  return key;
}

export function getAppSessionSecret() {
  const explicitSecret = process.env.APP_SESSION_SECRET;

  if (explicitSecret) {
    return explicitSecret;
  }

  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }

  throw new Error("Missing APP_SESSION_SECRET environment variable.");
}

export function hasAdminAuthEnv() {
  return Boolean(process.env.ADMIN_LOGIN_EMAIL && process.env.ADMIN_LOGIN_PASSWORD);
}

export function getAdminAuthEnv() {
  const email = process.env.ADMIN_LOGIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_LOGIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing ADMIN_LOGIN_EMAIL or ADMIN_LOGIN_PASSWORD environment variable.");
  }

  return { email, password };
}

export function hasGoogleSheetsImportEnv() {
  return Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getGoogleSheetsImportEnv() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const defaultVendorPin = process.env.IMPORT_DEFAULT_VENDOR_PIN || "1234";

  if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
    throw new Error("Missing Google Sheets import environment variables.");
  }

  return {
    spreadsheetId,
    serviceAccountEmail,
    privateKey,
    defaultVendorPin,
  };
}
