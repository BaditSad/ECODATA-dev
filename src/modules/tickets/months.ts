/** UTC year-month helpers for the archive pager. */

export function yearMonth(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentYearMonth(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftYearMonth(ym: string, delta: number): string {
  const [yearRaw, monthRaw] = ym.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatYearMonth(ym: string, locale: string): string {
  const [yearRaw, monthRaw] = ym.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function archiveMonthOf(row: {
  archived_at: string | null;
  completed_at?: string | null;
  closed_at?: string | null;
  updated_at: string;
}): string {
  return yearMonth(
    row.archived_at ?? row.completed_at ?? row.closed_at ?? row.updated_at
  );
}
