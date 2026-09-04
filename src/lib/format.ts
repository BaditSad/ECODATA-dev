import type { SensorStatus, SubscriptionStatus } from "@/types/database";
import type { Tone } from "@/components/console/ui";

/**
 * Formatting and domain-state helpers shared by both consoles.
 *
 * Everything here is deterministic and locale-fixed to `en-GB`. Server-rendered
 * timestamps formatted with the *server's* locale would differ from the
 * client's on rehydration, which React reports as a hydration mismatch.
 */

const LOCALE = "en-GB";

const dateTime = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const dateOnly = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const timeOnly = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return `${dateTime.format(date)} UTC`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? dateOnly.format(date) : "—";
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? timeOnly.format(date) : "—";
}

/**
 * Coarse relative time, computed against an explicit `now`.
 *
 * The caller passes `now` so a server render and its client counterpart agree.
 * Granularity stops at days because fleet decisions are made in those terms.
 */
export function formatRelative(
  iso: string | null | undefined,
  now: number
): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "never";

  const seconds = Math.round((now - then) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function formatPercent(
  value: number | null | undefined,
  digits = 0
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(LOCALE).format(value);
}

export function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return "—";
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
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return "—";
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
