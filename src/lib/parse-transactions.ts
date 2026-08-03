import * as XLSX from "xlsx";
import Papa from "papaparse";
import { createHash } from "node:crypto";

export type ParsedTransaction = {
  date: string; // ISO yyyy-mm-dd
  description: string;
  location: string | null;
  amount: number;
  sourceHash: string;
  rawRow: Record<string, unknown>;
};

const DATE_HEADER_ALIASES = ["date", "dato", "transaction date", "bokføringsdato", "bokført"];
const DESCRIPTION_HEADER_ALIASES = [
  "description",
  "beskrivelse",
  "tekst",
  "forklaring",
  "spesifikasjon",
  "text",
  "melding",
];
const AMOUNT_HEADER_ALIASES = ["amount", "beløp", "belop", "sum", "value"];
const LOCATION_HEADER_ALIASES = ["sted", "location", "place", "merchant"];

// Section titles above a table that indicate the rows below are debits/expenses
// shown as positive numbers (common in Norwegian bank exports, e.g. "Kjøp/uttak").
// If matched, positive amounts in that section are flipped to negative.
const EXPENSE_SECTION_PATTERN = /uttak|kjøp|belastning|trekk|gebyr/i;

type HeaderMapping = {
  dateIdx: number;
  amountIdx: number;
  descIdx?: number;
  locationIdx?: number;
  headerLabels: string[];
};

function cellToText(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return "";
  return String(cell).trim().toLowerCase();
}

function findAliasIndex(cellsText: string[], aliases: string[]): number | undefined {
  for (const alias of aliases) {
    const idx = cellsText.findIndex((t) => t === alias);
    if (idx !== -1) return idx;
  }
  for (const alias of aliases) {
    const idx = cellsText.findIndex((t) => t.includes(alias));
    if (idx !== -1) return idx;
  }
  return undefined;
}

function tryMatchHeaderRow(row: unknown[]): HeaderMapping | null {
  const cellsText = row.map(cellToText);
  const dateIdx = findAliasIndex(cellsText, DATE_HEADER_ALIASES);
  const amountIdx = findAliasIndex(cellsText, AMOUNT_HEADER_ALIASES);

  if (dateIdx === undefined || amountIdx === undefined) return null;

  const descIdx = findAliasIndex(cellsText, DESCRIPTION_HEADER_ALIASES);
  const locationIdx = findAliasIndex(cellsText, LOCATION_HEADER_ALIASES);

  return {
    dateIdx,
    amountIdx,
    descIdx,
    locationIdx,
    headerLabels: row.map((c) => (c === null || c === undefined ? "" : String(c).trim())),
  };
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

/**
 * Scans a sheet given as an array of raw rows (array-of-arrays) for one or more
 * tables. Handles real-world bank exports where a section title row (e.g.
 * "Kjøp/uttak") sits above the header row, and where a single sheet may contain
 * multiple such sections stacked on top of each other, each with its own header.
 */
function rowsToTransactions(rows: unknown[][]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  let mapping: HeaderMapping | null = null;
  let section: string | null = null;

  for (const row of rows) {
    const nonEmpty = row.filter((c) => cellToText(c) !== "");
    if (nonEmpty.length === 0) continue;

    const headerMatch = tryMatchHeaderRow(row);
    if (headerMatch) {
      mapping = headerMatch;
      continue;
    }

    // A row with a single populated cell (and no other columns filled) is
    // treated as a section title, e.g. "Kjøp/uttak" above its own header row.
    if (nonEmpty.length === 1) {
      section = String(nonEmpty[0]).trim();
      continue;
    }

    if (!mapping) continue; // data appeared before any recognizable header row

    const date = parseDate(row[mapping.dateIdx]);
    let amount = parseAmount(row[mapping.amountIdx]);
    const description = String(
      mapping.descIdx !== undefined ? (row[mapping.descIdx] ?? "") : "",
    ).trim();
    const location =
      mapping.locationIdx !== undefined
        ? String(row[mapping.locationIdx] ?? "").trim() || null
        : null;

    if (!date || amount === null || !description) continue;

    if (section && amount > 0 && EXPENSE_SECTION_PATTERN.test(section)) {
      amount = -amount;
    }

    const rawRow: Record<string, unknown> = {};
    mapping.headerLabels.forEach((label, i) => {
      rawRow[label || `col_${i}`] = row[i];
    });
    if (section) rawRow._section = section;

    transactions.push({
      date,
      description,
      location,
      amount,
      sourceHash: computeSourceHash(date, description, amount),
      rawRow,
    });
  }

  if (!mapping) {
    throw new Error(
      "Could not find a header row with recognizable date/description/amount columns.",
    );
  }

  return transactions;
}

export async function parseTransactionFile(file: File): Promise<ParsedTransaction[]> {
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";

  if (isCsv) {
    const text = await file.text();
    const result = Papa.parse<unknown[]>(text, {
      header: false,
      skipEmptyLines: true,
    });
    return rowsToTransactions(result.data);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: true,
    blankrows: false,
  });
  return rowsToTransactions(rows);
}
