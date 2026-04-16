import { addDays, addMonths, startOfDay, startOfMonth } from "date-fns";

export type TransactionDatePreset = "today" | "last7d" | "month";
export type TransactionSort = "asc" | "desc";

const DATE_PARAM_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function getSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export function isTransactionDatePreset(
  value: string | undefined,
): value is TransactionDatePreset {
  return value === "today" || value === "last7d" || value === "month";
}

export function isTransactionSort(
  value: string | undefined,
): value is TransactionSort {
  return value === "asc" || value === "desc";
}

export function parseDateParam(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const match = DATE_PARAM_RE.exec(value);

  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = startOfDay(new Date(year, month - 1, day));

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return undefined;
  }

  return parsed;
}

export function formatDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function normalizeDateParams(from?: string, to?: string): {
  from?: string;
  to?: string;
} {
  const parsedFrom = parseDateParam(from);
  const parsedTo = parseDateParam(to);

  if (!parsedFrom && !parsedTo) {
    return {};
  }

  if (!parsedFrom && parsedTo) {
    return { from: formatDateParam(parsedTo) };
  }

  if (parsedFrom && !parsedTo) {
    return { from: formatDateParam(parsedFrom) };
  }

  const start = parsedFrom! <= parsedTo! ? parsedFrom! : parsedTo!;
  const end = parsedFrom! <= parsedTo! ? parsedTo! : parsedFrom!;

  return {
    from: formatDateParam(start),
    to: formatDateParam(end),
  };
}

export function getTransactionDateRange({
  preset,
  from,
  to,
}: {
  preset?: TransactionDatePreset;
  from?: string;
  to?: string;
}): { gte?: Date; lt?: Date } {
  const today = startOfDay(new Date());

  if (preset === "today") {
    return { gte: today, lt: addDays(today, 1) };
  }

  if (preset === "last7d") {
    return { gte: addDays(today, -6), lt: addDays(today, 1) };
  }

  if (preset === "month") {
    const monthStart = startOfMonth(today);

    return { gte: monthStart, lt: addMonths(monthStart, 1) };
  }

  const normalized = normalizeDateParams(from, to);

  if (!normalized.from) {
    return {};
  }

  const rangeStart = parseDateParam(normalized.from)!;
  const rangeEnd = parseDateParam(normalized.to ?? normalized.from)!;

  return {
    gte: rangeStart,
    lt: addDays(rangeEnd, 1),
  };
}
