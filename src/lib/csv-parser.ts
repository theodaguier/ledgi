

export function decodeCSV(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (!utf8.includes("\uFFFD")) return utf8;
  try {
    return new TextDecoder("windows-1252").decode(buffer);
  } catch {
    return utf8;
  }
}

export interface ParsedTransaction {
  dateOperation: Date;
  dateValue?: Date;
  label: string;
  amount: number;
  type: "DEBIT" | "CREDIT" | "TRANSFER" | "FEE";
  rawData: Record<string, string>;
}

export interface ColumnMapping {
  dateOperation: string;
  dateValue?: string;
  label: string;
  amount: string;
  credit?: string;
  debit?: string;
  balance?: string;
}

export interface FormatProfile {
  name: string;
  dateFormat: string;
  dateColumns: string[];
  labelColumns: string[];
  amountColumns: string[];
  creditColumns: string[];
  debitColumns: string[];
  decimalSeparator: "." | ",";
  thousandsSeparator?: "" | " " | "," | ".";
  headerMappings: Record<string, string>;
}

export const KNOWN_FORMATS: FormatProfile[] = [
  {
    name: "boursorama",
    dateFormat: "dd/MM/yyyy",
    dateColumns: ["date operation", "date de l'operation", "date"],
    labelColumns: ["libelle", "libellé", "nature", "description"],
    amountColumns: ["montant", "amount"],
    creditColumns: ["credit", "crédit"],
    debitColumns: ["debit", "débit"],
    decimalSeparator: ",",
    thousandsSeparator: " ",
    headerMappings: {
      "date operation": "dateOperation",
      "date de l'operation": "dateOperation",
      "libelle": "label",
      "libellé": "label",
      "montant": "amount",
    },
  },
  {
    name: "revolut",
    dateFormat: "yyyy-MM-dd",
    dateColumns: ["date", "transaction date", "completed date"],
    labelColumns: ["description", "merchant", "reference"],
    amountColumns: ["amount", "fee"],
    creditColumns: [],
    debitColumns: [],
    decimalSeparator: ".",
    headerMappings: {
      "date": "dateOperation",
      "description": "label",
      "amount": "amount",
    },
  },
  {
    name: "bnp",
    dateFormat: "dd/MM/yyyy",
    dateColumns: ["date", "date operation", "datevaleur"],
    labelColumns: ["libelle", "libellé", "libelle operation"],
    amountColumns: ["montant"],
    creditColumns: ["credit", "montant credit"],
    debitColumns: ["debit", "montant debit"],
    decimalSeparator: ",",
    thousandsSeparator: " ",
    headerMappings: {},
  },
  {
    name: "ca",
    dateFormat: "dd/MM/yyyy",
    dateColumns: ["date", "date operation", "date comptabilisation"],
    labelColumns: ["libelle", "libellé", "libelle complet"],
    amountColumns: ["montant"],
    creditColumns: ["credit"],
    debitColumns: ["debit"],
    decimalSeparator: ",",
    thousandsSeparator: " ",
    headerMappings: {},
  },
];

export function normalizeHeader(header: string): string {
  let h = header;
  if (h.charCodeAt(0) === 0xfeff) h = h.slice(1);
  h = h.toLowerCase().trim();
  h = h.replace(/[\u2018\u2019\u201a\u201b]/g, "'");
  h = h.replace(/[\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5\u00e6\u00e7\u00e8\u00e9\u00ea\u00eb\u00ec\u00ed\u00ee\u00ef\u00f0\u00f1\u00f2\u00f3\u00f4\u00f5\u00f6\u00f8\u00f9\u00fa\u00fb\u00fc\u00fd\u00fe\u00ff]/gi, (c) =>
    "aaaaaaeeeeiiiiooooouuuuyy".charAt(c.charCodeAt(0) - 0xe0)
  );
  h = h.replace(/\s+/g, " ");
  h = h.replace(/[()[\]€$£¥]/g, "").trim();
  return h;
}

export function detectFormat(headers: string[]): FormatProfile | null {
  const normalizedHeaders = headers.map(normalizeHeader);

  for (const format of KNOWN_FORMATS) {
    let matches = 0;
    for (const col of format.dateColumns) {
      if (normalizedHeaders.includes(col)) matches++;
    }
    for (const col of format.labelColumns) {
      if (normalizedHeaders.includes(col)) matches++;
    }
    for (const col of format.amountColumns) {
      if (normalizedHeaders.includes(col)) matches++;
    }
    for (const col of format.creditColumns) {
      if (normalizedHeaders.includes(col)) matches++;
    }
    for (const col of format.debitColumns) {
      if (normalizedHeaders.includes(col)) matches++;
    }

    if (matches >= 2) {
      return format;
    }
  }

  return null;
}

const DATE_HEADER_KEYWORDS = ["date", "dateoperation", "dateope", "dateval", "dateop"];
const LABEL_HEADER_KEYWORDS = ["libelle", "libellé", "description", "nature", "reference", "merchant", "label", "nature"];
const AMOUNT_HEADER_KEYWORDS = ["montant", "amount", "somme", "balance", "credit", "débit", "debit"];

function looksLikeHeaderRow(columns: string[]): boolean {
  if (columns.length < 3) return false;
  const normalized = columns.map(normalizeHeader);

  let dateScore = 0;
  let labelScore = 0;
  let amountScore = 0;

  for (const h of normalized) {
    if (DATE_HEADER_KEYWORDS.some((k) => h.includes(k))) dateScore++;
    if (LABEL_HEADER_KEYWORDS.some((k) => h.includes(k))) labelScore++;
    if (AMOUNT_HEADER_KEYWORDS.some((k) => h.includes(k))) amountScore++;
  }

  if (dateScore >= 1 && labelScore >= 1 && amountScore >= 1) return true;
  if (dateScore >= 1 && labelScore >= 1) return true;
  if (detectFormat(columns)) return true;

  return false;
}

export function findColumn(headers: string[], candidates: string[]): string | null {
  const normalized = headers.map(normalizeHeader);
  const normCandidates = candidates.map((c) => normalizeHeader(c));

  for (let i = 0; i < normCandidates.length; i++) {
    const idx = normalized.indexOf(normCandidates[i]);
    if (idx !== -1) return headers[idx];
  }

  for (let i = 0; i < normCandidates.length; i++) {
    for (let j = 0; j < normalized.length; j++) {
      if (normalized[j].startsWith(normCandidates[i]) || normCandidates[i].startsWith(normalized[j])) {
        return headers[j];
      }
    }
  }

  return null;
}

export function findHeaderRow(content: string, separator: string): number {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const columns = parseCSVLine(lines[i], separator);
    if (looksLikeHeaderRow(columns)) return i;
  }
  return 0;
}

export function detectSeparator(content: string): string {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return ",";

  const firstMeaningfulLines = lines.slice(0, Math.min(lines.length, 5));

  const separators = [";", "\t", ",", "|"];
  let bestSeparator = ";";
  let maxCount = 0;

  for (const sep of separators) {
    const escaped = sep === "|" ? "\\|" : sep;
    const totalCount = firstMeaningfulLines.reduce(
      (sum, l) => sum + (l.match(new RegExp(escaped, "g")) || []).length,
      0,
    );
    if (totalCount > maxCount) {
      maxCount = totalCount;
      bestSeparator = sep;
    }
  }

  return bestSeparator;
}

export function parseAmount(value: string, profile: FormatProfile): number {
  if (!value || value.trim() === "") return 0;

  let cleaned = value.trim();

  if (profile.decimalSeparator === ",") {
    if (profile.thousandsSeparator === " ") {
      cleaned = cleaned.replace(/[\s\u00A0]/g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(",", ".");
    }
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parseDate(value: string, profile: FormatProfile): Date | null {
  if (!value) return null;

  const formats = [
    profile.dateFormat,
    "dd/MM/yyyy",
    "yyyy-MM-dd",
    "dd-MM-yyyy",
    "MM/dd/yyyy",
    "yyyy/MM/dd",
  ];

  for (const fmt of formats) {
    try {
      const parsed = parseDateWithFormat(value.trim(), fmt);
      if (parsed) return parsed;
    } catch {
      continue;
    }
  }

  const fallback = new Date(value);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function parseDateWithFormat(value: string, format: string): Date | null {
  const parts: Record<string, number> = {};

  const tokens = format.match(/yyyy|MM|dd|HH|mm|ss/g) || [];
  const regexStr = format
    .replace(/[-\[\](){}|\\^$*+?.()|[\]{}]/g, (m) => "\\" + m)
    .replace("yyyy", "(?<yyyy>\\d{4})")
    .replace("MM", "(?<MM>\\d{2})")
    .replace("dd", "(?<dd>\\d{2})")
    .replace("HH", "(?<HH>\\d{2})")
    .replace("mm", "(?<mm>\\d{2})")
    .replace("ss", "(?<ss>\\d{2})");

  const regex = new RegExp(regexStr);
  const match = value.match(regex);

  if (!match || !match.groups) return null;

  for (const token of tokens) {
    parts[token] = parseInt(match.groups[token], 10);
  }

  if (!parts["dd"] || !parts["MM"] || !parts["yyyy"]) return null;

  return new Date(parts["yyyy"], parts["MM"] - 1, parts["dd"]);
}

export function parseCSVLine(line: string, separator = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export function parseCSV(content: string, separator = ","): { headers: string[]; rows: string[][] } {
  const headerRowIndex = findHeaderRow(content, separator);
  const allFields: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (!inQuotes) {
      if (char === separator) {
        currentRow.push(currentField.trim());
        currentField = "";
        i++;
        continue;
      }

      if ((char === '\n') || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField.trim());
        if (currentRow.length > 0 && currentRow.some(f => f.trim() !== "")) {
          allFields.push(currentRow);
        }
        currentRow = [];
        currentField = "";
        if (char === '\r') i++;
        i++;
        continue;
      }
    }

    currentField += char;
    i++;
  }

  if (currentField.trim() !== "" || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.trim() !== "")) {
      allFields.push(currentRow);
    }
  }

  if (allFields.length === 0) return { headers: [], rows: [] };

  const headers = allFields[headerRowIndex] ?? allFields[0];
  const rows = allFields.slice(headerRowIndex + 1);

  return { headers, rows };
}

export function generateTransactionHash(
  date: Date,
  amount: number,
  label: string
): string {
  const data = `${date.toISOString().split("T")[0]}|${amount}|${label.toLowerCase().trim()}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function inferTransactionType(
  amount: number,
  profile: FormatProfile,
  row: Record<string, string>
): "DEBIT" | "CREDIT" | "TRANSFER" | "FEE" {
  if (amount < 0) return "TRANSFER";

  const label = Object.values(row).join(" ").toLowerCase();

  if (label.includes("frais") || label.includes("commission") || label.includes("fee")) {
    return "FEE";
  }

  if (label.includes("virement") || label.includes("transfert")) {
    return "TRANSFER";
  }

  return amount >= 0 ? "CREDIT" : "DEBIT";
}
