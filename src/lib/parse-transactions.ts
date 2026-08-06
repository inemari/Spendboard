import * as XLSX from "xlsx";
import Papa from "papaparse";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createHash } from "node:crypto";
import path from "node:path";

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

// Reassembles a PDF page's text runs into table-shaped rows. PDF text content
// has no notion of rows/columns, just positioned glyphs, so lines are
// reconstructed by clustering runs with near-identical y, and cells within a
// line by splitting on x-gaps wider than the run's own character spacing —
// the same signal a human eye uses to tell "one column" from "the next."
async function pdfToRows(buffer: ArrayBuffer): Promise<unknown[][]> {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: `${path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts")}/`,
  }).promise;

  const rows: unknown[][] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    const lines: { y: number; items: { x: number; text: string; width: number }[] }[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const text = item.str;
      if (!text.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      let line = lines.find((l) => Math.abs(l.y - y) < 3);
      if (!line) {
        line = { y, items: [] };
        lines.push(line);
      }
      line.items.push({ x, text, width: item.width });
    }

    // PDF y grows upward, so descending y walks the page top-to-bottom.
    lines.sort((a, b) => b.y - a.y);

    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let current = "";
      let prevEnd: number | null = null;
      for (const it of line.items) {
        const gap = prevEnd === null ? 0 : it.x - prevEnd;
        const avgCharWidth = it.width / Math.max(it.text.length, 1);
        const gapThreshold = Math.max(avgCharWidth * 2.5, 8);
        if (prevEnd !== null && gap > gapThreshold) {
          cells.push(current.trim());
          current = it.text;
        } else {
          current += (current && !current.endsWith(" ") ? " " : "") + it.text;
        }
        prevEnd = it.x + it.width;
      }
      if (current) cells.push(current.trim());
      rows.push(cells);
    }
  }

  return rows;
}

export async function parseTransactionFile(file: File): Promise<ParsedTransaction[]> {
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv") || file.type === "text/csv";
  const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";

  if (isCsv) {
    const text = await file.text();
    const result = Papa.parse<unknown[]>(text, {
      header: false,
      skipEmptyLines: true,
    });
    return rowsToTransactions(result.data);
  }

  if (isPdf) {
    const buffer = await file.arrayBuffer();
    const rows = await pdfToRows(buffer);
    return rowsToTransactions(rows);
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
