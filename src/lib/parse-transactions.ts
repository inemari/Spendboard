import * as XLSX from "xlsx";
import Papa from "papaparse";
import { createHash } from "node:crypto";

export type ParsedTransaction = {
  date: string; // ISO yyyy-mm-dd
  description: string;
  amount: number;
  sourceHash: string;
  rawRow: Record<string, unknown>;
};

const DATE_HEADER_ALIASES = ["date", "dato", "transaction date", "bokføringsdato"];
const DESCRIPTION_HEADER_ALIASES = [
  "description",
  "beskrivelse",
  "tekst",
  "forklaring",
  "text",
  "melding",
];
const AMOUNT_HEADER_ALIASES = [
  "amount",
  "beløp",
  "belop",
  "sum",
  "value",
];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function findColumn(headers: string[], aliases: string[]): string | undefined {
  const normalized = headers.map((h) => ({ original: h, normalized: normalizeHeader(h) }));
  for (const alias of aliases) {
    const match = normalized.find((h) => h.normalized === alias);
    if (match) return match.original;
  }
  // fall back to partial match
  for (const alias of aliases) {
    const match = normalized.find((h) => h.normalized.includes(alias));
    if (match) return match.original;
  }
  return undefined;
}

function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return null;

  const cleaned = raw
    .replace(/[^\d,.\-]/g, "") // strip currency symbols, spaces (incl. non-breaking)
    .trim();

  if (!cleaned) return null;

  // Handle "1.234,56" (Norwegian) vs "1,234.56" (US) vs plain "1234,56" / "1234.56"
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized = cleaned;
  if (hasComma && hasDot) {
    // whichever separator appears last is the decimal separator
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".");
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseDate(raw: unknown): string | null {
  if (raw instanceof Date) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === "number") {
    // Excel serial date
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (!parsed) return null;
    const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    return d.toISOString().slice(0, 10);
  }
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();

  // dd.mm.yyyy or dd/mm/yyyy or dd-mm-yyyy
  const dmy = trimmed.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // yyyy-mm-dd already
  const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString().slice(0, 10);
  }

  return null;
}

function computeSourceHash(date: string, description: string, amount: number): string {
  return createHash("sha256")
    .update(`${date}|${description.trim().toLowerCase()}|${amount.toFixed(2)}`)
    .digest("hex");
}

function rowsToTransactions(rows: Record<string, unknown>[]): ParsedTransaction[] {
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const dateCol = findColumn(headers, DATE_HEADER_ALIASES);
  const descCol = findColumn(headers, DESCRIPTION_HEADER_ALIASES);
  const amountCol = findColumn(headers, AMOUNT_HEADER_ALIASES);

  if (!dateCol || !descCol || !amountCol) {
    throw new Error(
      `Could not identify required columns. Found headers: ${headers.join(", ")}. ` +
        `Expected columns for date, description, and amount.`,
    );
  }

  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const date = parseDate(row[dateCol]);
    const amount = parseAmount(row[amountCol]);
    const description = String(row[descCol] ?? "").trim();

    if (!date || amount === null || !description) continue;

    transactions.push({
      date,
      description,
      amount,
      sourceHash: computeSourceHash(date, description, amount),
      rawRow: row,
    });
  }

  return transactions;
}

export async function parseTransactionFile(file: File): Promise<ParsedTransaction[]> {
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";

  if (isCsv) {
    const text = await file.text();
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    return rowsToTransactions(result.data);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { raw: true });
  return rowsToTransactions(rows);
}
