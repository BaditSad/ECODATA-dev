import type {
  BillingCycle,
  ContractStatus,
  IncidentStatus,
  InvoiceStatus,
  SensorStatus,
  SubscriptionStatus,
  TicketDepartment,
  TicketPriority,
  TicketStatus,
  TicketBoardColumn,
} from "@/types/database";
import type { Tone } from "@/components/console/ui";
import { DEFAULT_LOCALE, dateLocale, type Locale } from "@/i18n/types";
import { fill } from "@/i18n/console";

/**
 * Formatting and domain-state helpers shared by both consoles.
 *
 * Timestamps use the active UI locale with a fixed UTC zone so a server render
 * and its client counterpart stay in lockstep.
 */

type DatePack = {
  dateTime: Intl.DateTimeFormat;
  dateOnly: Intl.DateTimeFormat;
  timeOnly: Intl.DateTimeFormat;
  number: Intl.NumberFormat;
};

const datePacks = new Map<Locale, DatePack>();

function datePack(locale: Locale = DEFAULT_LOCALE): DatePack {
  const cached = datePacks.get(locale);
  if (cached) return cached;
  const tag = dateLocale(locale);
  const pack: DatePack = {
    dateTime: new Intl.DateTimeFormat(tag, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }),
    dateOnly: new Intl.DateTimeFormat(tag, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }),
    timeOnly: new Intl.DateTimeFormat(tag, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }),
    number: new Intl.NumberFormat(tag),
  };
  datePacks.set(locale, pack);
  return pack;
}

export function formatDateTime(
  iso: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE
): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "-";
  return `${datePack(locale).dateTime.format(date)} UTC`;
}

export function formatDate(
  iso: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE
): string {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? datePack(locale).dateOnly.format(date) : "-";
}

export function formatTime(
  iso: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE
): string {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? datePack(locale).timeOnly.format(date) : "-";
}

export type RelativeCopy = {
  never: string;
  justNow: string;
  minutesAgo: string;
  hoursAgo: string;
  yesterday: string;
  daysAgo: string;
};

/**
 * Coarse relative time, computed against an explicit `now`.
 *
 * The caller passes `now` so a server render and its client counterpart agree.
 * Granularity stops at days because fleet decisions are made in those terms.
 */
export function formatRelative(
  iso: string | null | undefined,
  now: number,
  copy?: RelativeCopy
): string {
  const relative: RelativeCopy = copy ?? {
    never: "jamais",
    justNow: "à l’instant",
    minutesAgo: "il y a {n} min",
    hoursAgo: "il y a {n} h",
    yesterday: "hier",
    daysAgo: "il y a {n} j",
  };
  if (!iso) return relative.never;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return relative.never;

  const seconds = Math.round((now - then) / 1000);
  if (seconds < 0) return relative.justNow;
  if (seconds < 60) return relative.justNow;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return fill(relative.minutesAgo, { n: minutes });

  const hours = Math.round(minutes / 60);
  if (hours < 24) return fill(relative.hoursAgo, { n: hours });

  const days = Math.round(hours / 24);
  return days === 1 ? relative.yesterday : fill(relative.daysAgo, { n: days });
}

export function formatPercent(
  value: number | null | undefined,
  digits = 0
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat(dateLocale(DEFAULT_LOCALE)).format(value);
}

/** Integer cents → a currency string. The ERP stores money as cents. */
export function formatMoney(
  cents: number | null | undefined,
  currency = "EUR"
): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "-";
  return new Intl.NumberFormat(dateLocale(DEFAULT_LOCALE), {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** Form input in euros (comma or dot) → integer cents, or null if unusable. */
export function parseEurosToCents(raw: unknown): number | null {
  const n = Number(String(raw ?? "").trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Whole calendar days from `fromIso` to `toIso`. Negative means already past. */
export function daysUntil(toIso: string, from = Date.now()): number {
  const target = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((target - from) / 86_400_000);
}

export function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return "-";
  }
  if (value === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(value) / Math.log(1024))
  );
  const scaled = value / 1024 ** exponent;
  return `${scaled.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return "-";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

/* ── Domain state → tone ─────────────────────────────────────────────────── */

export function sensorStatusTone(status: SensorStatus): Tone {
  switch (status) {
    case "active":
      return "positive";
    case "degraded":
    case "provisioning":
      return "attention";
    case "offline":
      return "critical";
    case "retired":
      return "neutral";
  }
}

export const SENSOR_STATUS_LABEL: Record<SensorStatus, string> = {
  provisioning: "Provisioning",
  active: "Active",
  degraded: "Degraded",
  offline: "Offline",
  retired: "Retired",
};

export function subscriptionTone(status: SubscriptionStatus): Tone {
  switch (status) {
    case "active":
      return "positive";
    case "trial":
      return "neutral";
    case "past_due":
      return "attention";
    case "suspended":
    case "churned":
      return "critical";
  }
}

export const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> = {
  trial: "Trial",
  active: "Active",
  past_due: "Past due",
  suspended: "Suspended",
  churned: "Churned",
};

/**
 * Battery tone on the LiFePO4 curve.
 *
 * The chemistry holds ~3.2–3.3 V across most of its discharge and then drops
 * off a cliff, so a percentage derived from voltage is optimistic right up to
 * cut-off. The thresholds are therefore conservative: 30% already warrants
 * scheduling a field visit, not waiting for 10%.
 */
export function batteryTone(level: number | null | undefined): Tone {
  if (level === null || level === undefined) return "neutral";
  if (level >= 50) return "positive";
  if (level >= 30) return "attention";
  return "critical";
}

/**
 * 4G/LTE-M signal quality from RSRP in dBm.
 *
 * Bands follow the usual LTE interpretation: better than -90 is comfortable,
 * -90 to -110 works but retries, below -110 will drop uploads.
 */
export function signalLabel(rssi: number | null | undefined): {
  label: string;
  tone: Tone;
} {
  if (rssi === null || rssi === undefined) return { label: "No reading", tone: "neutral" };
  if (rssi >= -90) return { label: `Strong · ${rssi} dBm`, tone: "positive" };
  if (rssi >= -110) return { label: `Fair · ${rssi} dBm`, tone: "attention" };
  return { label: `Weak · ${rssi} dBm`, tone: "critical" };
}

/**
 * Whether a unit has gone quiet.
 *
 * Balises report at least hourly, so three missed windows is a real fault
 * rather than a slow link.
 */
export const STALE_PING_MS = 3 * 60 * 60 * 1000;

export function isPingStale(
  lastPing: string | null | undefined,
  now: number
): boolean {
  if (!lastPing) return true;
  const then = new Date(lastPing).getTime();
  if (!Number.isFinite(then)) return true;
  return now - then > STALE_PING_MS;
}

/** Confidence phrasing, aligned with the 0.85 auto-publish threshold. */
export function confidenceTone(score: number): Tone {
  if (score >= 0.85) return "positive";
  if (score >= 0.7) return "attention";
  return "critical";
}

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Draft",
  active: "Active",
  ended: "Ended",
  cancelled: "Cancelled",
};

export function contractStatusTone(status: ContractStatus): Tone {
  switch (status) {
    case "active":
      return "positive";
    case "draft":
      return "neutral";
    case "ended":
      return "attention";
    case "cancelled":
      return "critical";
  }
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
  void: "Void",
};

export function invoiceStatusTone(
  status: InvoiceStatus,
  dueOn: string,
  now = Date.now()
): Tone {
  if (status === "paid") return "positive";
  if (status === "void" || status === "draft") return "neutral";
  return new Date(`${dueOn}T00:00:00Z`).getTime() < now ? "critical" : "attention";
}

export function invoiceDisplayStatus(
  status: InvoiceStatus,
  dueOn: string,
  now = Date.now()
): string {
  if (status === "issued" && new Date(`${dueOn}T00:00:00Z`).getTime() < now) {
    return "Overdue";
  }
  return INVOICE_STATUS_LABEL[status];
}

export const TICKET_BOARD_COLUMNS: readonly TicketBoardColumn[] = [
  "draft",
  "waiting",
  "in_progress",
  "done",
];

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  draft: "Draft",
  waiting: "Waiting",
  in_progress: "In progress",
  done: "Done",
  archived: "Archived",
};

export const TICKET_COLUMN_COLOR: Record<
  TicketBoardColumn,
  { fg: string; soft: string; line: string }
> = {
  draft: {
    fg: "var(--edl-muted)",
    soft: "var(--edl-soft)",
    line: "var(--edl-border-strong)",
  },
  waiting: {
    fg: "var(--edl-gold)",
    soft: "var(--edl-gold-10)",
    line: "var(--edl-gold-40)",
  },
  in_progress: {
    fg: "var(--edl-sky)",
    soft: "var(--edl-sky-10)",
    line: "var(--edl-sky-40)",
  },
  done: {
    fg: "var(--edl-emerald)",
    soft: "var(--edl-emerald-10)",
    line: "var(--edl-emerald-30)",
  },
};

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
  suspended: "Suspended",
  archived: "Archived",
};

export function ticketStatusTone(status: TicketStatus): Tone {
  switch (status) {
    case "draft":
      return "neutral";
    case "waiting":
      return "attention";
    case "in_progress":
      return "neutral";
    case "done":
      return "positive";
    case "archived":
      return "neutral";
  }
}

export function incidentStatusTone(status: IncidentStatus): Tone {
  switch (status) {
    case "open":
      return "attention";
    case "in_progress":
      return "neutral";
    case "resolved":
      return "positive";
    case "closed":
      return "neutral";
    case "suspended":
      return "attention";
    case "archived":
      return "neutral";
  }
}

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export function ticketPriorityTone(priority: TicketPriority): Tone {
  switch (priority) {
    case "low":
      return "neutral";
    case "normal":
      return "positive";
    case "high":
      return "attention";
    case "urgent":
      return "critical";
  }
}

export const TICKET_DEPARTMENT_LABEL: Record<TicketDepartment, string> = {
  it: "IT",
  commerce: "Commerce",
  marketing: "Marketing",
};

export const TICKET_DEPARTMENT_COLOR: Record<
  TicketDepartment,
  { fg: string; soft: string }
> = {
  it: { fg: "var(--edl-sky)", soft: "var(--edl-sky-10)" },
  commerce: { fg: "var(--edl-gold)", soft: "var(--edl-gold-10)" },
  marketing: { fg: "var(--edl-violet)", soft: "var(--edl-violet-10)" },
};
