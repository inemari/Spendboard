import * as XLSX from "xlsx";
import Papa from "papaparse";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createHash } from "node:crypto";
import path from "node:path";
import { STATEMENT_FORMATS, type HeaderAliases } from "./statement-formats";

export type ParsedTransaction = {
  date: string; // ISO yyyy-mm-dd
  description: string;
  location: string | null;
  amount: number;
  sourceHash: string;
  rawRow: Record<string, unknown>;
};

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

function tryMatchHeaderRow(row: unknown[], aliases: HeaderAliases): HeaderMapping | null {
  const cellsText = row.map(cellToText);
  const dateIdx = findAliasIndex(cellsText, aliases.date);
  const amountIdx = findAliasIndex(cellsText, aliases.amount);

  if (dateIdx === undefined || amountIdx === undefined) return null;

  const descIdx = findAliasIndex(cellsText, aliases.description);
  const locationIdx = findAliasIndex(cellsText, aliases.location);

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

  // yyyy-mm-dd, yyyy/mm/dd, or yyyy.mm.dd
  const ymd = trimmed.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
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
function rowsToTransactions(rows: unknown[][], aliases: HeaderAliases): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  let mapping: HeaderMapping | null = null;
  let section: string | null = null;

  for (const row of rows) {
    const nonEmpty = row.filter((c) => cellToText(c) !== "");
    if (nonEmpty.length === 0) continue;

    const headerMatch = tryMatchHeaderRow(row, aliases);
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

  // No header row matched this alias set at all — same outcome as matching
  // a header but finding zero data rows under it, so no separate error:
  // `transactions` is already empty whenever `mapping` never got set, since
  // every row before a mapping exists is skipped above.
  return transactions;
}

type PdfTextItem = { x: number; text: string; width: number };

// Splits one line's text runs into cells by x-gaps wider than the runs' own
// character spacing — the same signal a human eye uses to tell "one column"
// from "the next." Only used before a header row is known (title/section
// lines) and to find the header row itself; once columns are known, data
// rows are bucketed by position instead (see below) so a blank cell can't
// shift every later column left.
function clusterLineByGap(items: PdfTextItem[]): { x: number; text: string }[] {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const cells: { x: number; text: string }[] = [];
  let current = "";
  let startX = 0;
  let prevEnd: number | null = null;
  for (const it of sorted) {
    const gap = prevEnd === null ? 0 : it.x - prevEnd;
    const avgCharWidth = it.width / Math.max(it.text.length, 1);
    const gapThreshold = Math.max(avgCharWidth * 2.5, 8);
    if (prevEnd !== null && gap > gapThreshold) {
      cells.push({ x: startX, text: current.trim() });
      current = it.text;
      startX = it.x;
    } else {
      if (!current) startX = it.x;
      current += current && !current.endsWith(" ") ? ` ${it.text}` : it.text;
    }
    prevEnd = it.x + it.width;
  }
  if (current) cells.push({ x: startX, text: current.trim() });
  return cells;
}

// Reassembles a PDF page's text runs into table-shaped rows. PDF text content
// has no notion of rows/columns, just positioned glyphs, so lines are
// reconstructed by clustering runs with near-identical y. Once the header
// row is located (via the same alias matching `rowsToTransactions` uses),
// every later line is column-aligned by bucketing its runs into the
// header's own x-positions rather than re-splitting on gaps — a row with a
// blank cell (e.g. no reference number) has fewer gaps, and re-splitting it
// would shift every column after the blank one out of alignment.
async function pdfToRows(buffer: ArrayBuffer, aliases: HeaderAliases): Promise<unknown[][]> {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: `${path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts")}/`,
  }).promise;

  const rows: unknown[][] = [];
  let columnStarts: number[] | null = null;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    const lines: { y: number; items: PdfTextItem[] }[] = [];
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
      if (!columnStarts) {
        const cells = clusterLineByGap(line.items);
        if (tryMatchHeaderRow(cells.map((c) => c.text), aliases)) {
          columnStarts = cells.map((c) => c.x);
        }
        rows.push(cells.map((c) => c.text));
        continue;
      }

      const cells = new Array(columnStarts.length).fill("") as string[];
      for (const it of line.items) {
        let colIdx = 0;
        for (let i = 0; i < columnStarts.length; i++) {
          if (it.x >= columnStarts[i] - 2) colIdx = i;
          else break;
        }
        cells[colIdx] = cells[colIdx] ? `${cells[colIdx]} ${it.text}` : it.text;
      }
      rows.push(cells);
    }
  }

  return rows;
}

// The user picks a file, not a bank — so instead of asking which format it
// is, every format whose accepted extensions include this file's extension
// gets tried against the actual content, and whichever extracts the most
// transactions wins. This is what lets one file's real columns (which are
// what they are, regardless of what the user assumes their bank calls them —
// see the Nordea CSV whose "Navn" column is always blank) settle the
// ambiguity instead of a name picked from a dropdown.
export async function parseTransactionFile(file: File): Promise<ParsedTransaction[]> {
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv") || file.type === "text/csv";
  const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
  const extension = isPdf ? ".pdf" : isCsv ? ".csv" : ".xlsx";

  const candidates = STATEMENT_FORMATS.filter((f) =>
    f.accept.split(",").includes(extension),
  );

  let best: ParsedTransaction[] = [];

  if (isPdf) {
    const buffer = await file.arrayBuffer();
    for (const format of candidates) {
      const rows = await pdfToRows(buffer, format.aliases);
      const transactions = rowsToTransactions(rows, format.aliases);
      if (transactions.length > best.length) best = transactions;
    }
    return best;
  }

  if (isCsv) {
    // File#text() decodes with TextDecoder, which strips a leading UTF-8 BOM
    // by default — no separate handling needed for "UTF-8 med BOM" exports.
    const text = await file.text();
    for (const format of candidates) {
      const result = Papa.parse<unknown[]>(text, {
        header: false,
        skipEmptyLines: true,
        delimiter: format.csvDelimiter ?? "",
      });
      const transactions = rowsToTransactions(result.data, format.aliases);
      if (transactions.length > best.length) best = transactions;
    }
    return best;
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: true,
    blankrows: false,
  });
  for (const format of candidates) {
    const transactions = rowsToTransactions(rows, format.aliases);
    if (transactions.length > best.length) best = transactions;
  }
  return best;
}
