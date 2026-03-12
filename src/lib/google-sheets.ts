import { google } from "googleapis";
import { getGoogleSheetsImportEnv } from "@/lib/env";

export type SheetRow = Record<string, string>;

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toRows(values: string[][]): SheetRow[] {
  if (!values.length) return [];

  const [headerRow, ...bodyRows] = values;
  const headers = headerRow.map((header) => normalizeHeader(String(header ?? "")));

  return bodyRows
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => {
      const record: SheetRow = {};
      headers.forEach((header, index) => {
        if (header) {
          record[header] = String(row[index] ?? "").trim();
        }
      });
      return record;
    });
}

export async function readGoogleSheetTabs(tabNames: string[]) {
  const { spreadsheetId, serviceAccountEmail, privateKey } = getGoogleSheetsImportEnv();

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const responses = await Promise.all(
    tabNames.map(async (tabName) => {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${tabName}!A:ZZ`,
      });

      return {
        tabName,
        rows: toRows((response.data.values as string[][] | undefined) ?? []),
      };
    }),
  );

  return Object.fromEntries(responses.map((entry) => [entry.tabName, entry.rows])) as Record<
    string,
    SheetRow[]
  >;
}
