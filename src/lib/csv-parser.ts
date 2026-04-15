

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

export function detectFormat(headers: string[]): FormatProfile | null {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

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

    if (matches >= 2) {
      return format;
    }
  }

  return null;
}

export function parseAmount(value: string, profile: FormatProfile): number {
  if (!value || value.trim() === "") return 0;

  let cleaned = value.trim();

  if (profile.decimalSeparator === ",") {
    if (profile.thousandsSeparator === " ") {
      cleaned = cleaned.replace(/ /g, "").replace(",", ".");
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
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0], separator);
  const rows = lines.slice(1).map((line) => parseCSVLine(line, separator));

  return { headers, rows };
}

export function detectSeparator(content: string): string {
  const firstLine = content.split(/\r?\n/)[0] ?? "";

  const separators = [",", ";", "\t", "|"];
  let bestSeparator = ",";
  let maxCount = 0;

  for (const sep of separators) {
    const count = (firstLine.match(new RegExp(sep === "|" ? "\\|" : sep, "g")) || []).length;
    if (count > maxCount) {
      maxCount = count;
      bestSeparator = sep;
    }
  }

  return bestSeparator;
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
