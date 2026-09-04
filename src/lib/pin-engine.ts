/**
 * Eco-Data Link — guest access code rotation engine.
 *
 * ── The invariant ───────────────────────────────────────────────────────────
 * Codes rotate on a fixed cadence and each stays valid longer than the cadence,
 * so consecutive windows always intersect:
 *
 *     overlap = validity − cadence
 *
 * A guest who checked in the day before a rollover keeps working access for the
 * whole overlap. Because every window opens strictly before its predecessor
 * closes, coverage is provably gapless — there is no instant at which no code
 * is live, which is the property that makes "zero service interruption" a
 * guarantee rather than an aspiration.
 *
 * ── Why the default cadence is 28 days, not a calendar month ────────────────
 * The brief asks for three things at once: generate monthly, stay valid six
 * weeks, overlap exactly two weeks. Those are only simultaneously satisfiable
 * if the cadence is exactly four weeks:
 *
 *     42 days validity − 14 days overlap = 28 days cadence
 *
 * Calendar months are 28–31 days, so a calendar cadence yields an overlap that
 * drifts between 11 and 14 days and shifts the rotation day-of-week every
 * month. `FOUR_WEEK` is therefore the default: it rotates ~13 times a year on
 * a stable weekday and honours the exact two-week overlap. `CALENDAR_MONTH`
 * remains available for a client contractually tied to a calendar boundary;
 * its overlap is computed per cycle instead of assumed.
 *
 * All arithmetic is UTC-absolute. Windows are instants, not local dates, so a
 * resort crossing a DST boundary never loses or double-counts an hour of
 * validity.
 */

/* ── Units ───────────────────────────────────────────────────────────────── */

const MS_PER_DAY = 86_400_000;

export const DAYS_PER_WEEK = 7;

/** Six weeks, as specified. */
export const VALIDITY_DAYS = 42;

/** Four weeks: the cadence that makes the overlap exactly two weeks. */
export const CADENCE_DAYS = 28;

/** Two weeks, as specified. */
export const OVERLAP_DAYS = VALIDITY_DAYS - CADENCE_DAYS;

export type RotationCadence = "FOUR_WEEK" | "CALENDAR_MONTH";

export interface RotationPolicy {
  cadence: RotationCadence;
  /** How long each issued code remains usable, in days. */
  validityDays: number;
}

export const DEFAULT_ROTATION_POLICY: RotationPolicy = {
  cadence: "FOUR_WEEK",
  validityDays: VALIDITY_DAYS,
};

export const CALENDAR_ROTATION_POLICY: RotationPolicy = {
  cadence: "CALENDAR_MONTH",
  validityDays: VALIDITY_DAYS,
};

/* ── Code windows ────────────────────────────────────────────────────────── */

export interface CodeWindow {
  /** Monotonic rotation counter. Maps to `tenant_access_codes.cycle_index`. */
  cycleIndex: number;
  validFrom: Date;
  validUntil: Date;
}

export interface RotationPlanEntry extends CodeWindow {
  /** Milliseconds this window shares with its immediate predecessor. */
  overlapWithPreviousMs: number;
  /** True when the predecessor closes at or after this window opens. */
  continuousFromPrevious: boolean;
}

/* ── Anchor normalisation ────────────────────────────────────────────────── */

/**
 * Snap an onboarding date to the UTC midnight that starts cycle 0.
 *
 * Normalising the anchor keeps every derived window landing on a whole day,
 * which makes issued validity dates legible on a printed key card.
 */
export function normalizeAnchor(anchor: Date | string | number): Date {
  const raw = anchor instanceof Date ? anchor : new Date(anchor);
  const ms = raw.getTime();
  if (!Number.isFinite(ms)) {
    throw new RangeError(`Invalid rotation anchor: ${String(anchor)}`);
  }
  return new Date(
    Date.UTC(
      raw.getUTCFullYear(),
      raw.getUTCMonth(),
      raw.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
}

function addDaysUtc(from: Date, days: number): Date {
  return new Date(from.getTime() + days * MS_PER_DAY);
}

/**
 * Add whole UTC months, clamping to the last valid day of the target month.
 *
 * Without the clamp, a 31 January anchor would roll to 3 March in a non-leap
 * year and permanently shift the tenant's rotation day.
 */
function addMonthsUtc(from: Date, months: number): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + months;
  const day = from.getUTCDate();

  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;

  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0)
  ).getUTCDate();

  return new Date(
    Date.UTC(targetYear, targetMonth, Math.min(day, daysInTargetMonth), 0, 0, 0, 0)
  );
}

/** Instant at which the given cycle opens. */
export function cycleStart(
  anchor: Date,
  cycleIndex: number,
  policy: RotationPolicy = DEFAULT_ROTATION_POLICY
): Date {
  if (!Number.isInteger(cycleIndex) || cycleIndex < 0) {
    throw new RangeError(`cycleIndex must be a non-negative integer, got ${cycleIndex}`);
  }
  const base = normalizeAnchor(anchor);
  return policy.cadence === "CALENDAR_MONTH"
    ? addMonthsUtc(base, cycleIndex)
    : addDaysUtc(base, cycleIndex * CADENCE_DAYS);
}

/** Full validity window for one cycle. */
export function windowForCycle(
  anchor: Date,
  cycleIndex: number,
  policy: RotationPolicy = DEFAULT_ROTATION_POLICY
): CodeWindow {
  const validFrom = cycleStart(anchor, cycleIndex, policy);
  return {
    cycleIndex,
    validFrom,
    validUntil: addDaysUtc(validFrom, policy.validityDays),
  };
}

/**
 * Index of the most recently opened cycle at `at`.
 *
 * Returns -1 when `at` precedes the anchor, so callers can distinguish
 * "not yet onboarded" from "cycle 0".
 */
export function currentCycleIndex(
  anchor: Date,
  at: Date = new Date(),
  policy: RotationPolicy = DEFAULT_ROTATION_POLICY
): number {
  const base = normalizeAnchor(anchor);
  if (at.getTime() < base.getTime()) return -1;

  if (policy.cadence === "FOUR_WEEK") {
    return Math.floor((at.getTime() - base.getTime()) / (CADENCE_DAYS * MS_PER_DAY));
  }

  // Calendar cadence: month distance, then step back if the day-of-month has
  // not yet been reached this month.
  const months =
    (at.getUTCFullYear() - base.getUTCFullYear()) * 12 +
    (at.getUTCMonth() - base.getUTCMonth());
  const candidate = Math.max(0, months);
  return cycleStart(base, candidate, policy).getTime() > at.getTime()
    ? candidate - 1
    : candidate;
}

/**
 * Every window live at `at`, oldest first.
 *
 * Under the default policy this is two codes during the two-week overlap that
 * follows each rotation, and one code for the remaining two weeks. An empty
 * result means `at` precedes onboarding — never a coverage gap.
 */
export function activeWindows(
  anchor: Date,
  at: Date = new Date(),
  policy: RotationPolicy = DEFAULT_ROTATION_POLICY
): CodeWindow[] {
  const newest = currentCycleIndex(anchor, at, policy);
  if (newest < 0) return [];

  const live: CodeWindow[] = [];
  // A window spans at most ceil(validity / cadence) cycles, so walking back
  // that many indices is sufficient and bounded.
  const reach = Math.ceil(policy.validityDays / CADENCE_DAYS) + 1;

  for (let index = Math.max(0, newest - reach); index <= newest; index += 1) {
    const window = windowForCycle(anchor, index, policy);
    if (
      window.validFrom.getTime() <= at.getTime() &&
      window.validUntil.getTime() > at.getTime()
    ) {
      live.push(window);
    }
  }

  return live;
}

/** Milliseconds two windows share. Zero when they merely touch or are disjoint. */
export function overlapMs(earlier: CodeWindow, later: CodeWindow): number {
  const start = Math.max(earlier.validFrom.getTime(), later.validFrom.getTime());
  const end = Math.min(earlier.validUntil.getTime(), later.validUntil.getTime());
  return Math.max(0, end - start);
}

/** When the next code must be minted for the overlap to hold. */
export function nextRotationAt(
  anchor: Date,
  at: Date = new Date(),
  policy: RotationPolicy = DEFAULT_ROTATION_POLICY
): Date {
  const current = currentCycleIndex(anchor, at, policy);
  return cycleStart(anchor, Math.max(0, current + 1), policy);
}

/**
 * True when the tenant's newest issued cycle is behind schedule.
 *
 * The cron job calls this rather than comparing dates itself: a rotation is due
 * as soon as the current cycle index exceeds the highest cycle on record.
 */
export function isRotationDue(
  anchor: Date,
  latestIssuedCycle: number | null,
  at: Date = new Date(),
  policy: RotationPolicy = DEFAULT_ROTATION_POLICY
): boolean {
  const current = currentCycleIndex(anchor, at, policy);
  if (current < 0) return false;
  if (latestIssuedCycle === null) return true;
  return current > latestIssuedCycle;
}

/**
 * Cycles that should exist at `at` but do not.
 *
 * Backfills a tenant whose cron missed runs. Ordered oldest first so codes are
 * inserted in cycle order and `cycle_index` stays dense.
 */
export function missingCycles(
  anchor: Date,
  issuedCycles: readonly number[],
  at: Date = new Date(),
  policy: RotationPolicy = DEFAULT_ROTATION_POLICY
): number[] {
  const current = currentCycleIndex(anchor, at, policy);
  if (current < 0) return [];

  const issued = new Set(issuedCycles);
  const missing: number[] = [];

  // Only cycles that are still live matter; anything fully expired is history
  // and backfilling it would burn PINs from the shared keyspace for nothing.
  for (let index = 0; index <= current; index += 1) {
    if (issued.has(index)) continue;
    const window = windowForCycle(anchor, index, policy);
    if (window.validUntil.getTime() > at.getTime()) missing.push(index);
  }

  return missing;
}

/** Rotation schedule with the overlap made explicit for each step. */
export function rotationPlan(
  anchor: Date,
  fromCycle: number,
  count: number,
  policy: RotationPolicy = DEFAULT_ROTATION_POLICY
): RotationPlanEntry[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`count must be a positive integer, got ${count}`);
  }

  const plan: RotationPlanEntry[] = [];

  for (let step = 0; step < count; step += 1) {
    const index = fromCycle + step;
    const window = windowForCycle(anchor, index, policy);
    const previous =
      index > 0 ? windowForCycle(anchor, index - 1, policy) : null;

    const overlap = previous ? overlapMs(previous, window) : 0;

    plan.push({
      ...window,
      overlapWithPreviousMs: overlap,
      // Cycle 0 has no predecessor to be continuous with, so it is trivially
      // continuous; every later cycle must genuinely intersect.
      continuousFromPrevious: previous === null ? true : overlap > 0,
    });
  }

  return plan;
}

export interface ContinuityReport {
  continuous: boolean;
  /** Distinct overlap durations observed, in days, ascending. */
  overlapDaysObserved: number[];
  /** Cycle indices that open at or after their predecessor closes. */
  gapsAtCycles: number[];
}

/**
 * Audit a stretch of the schedule for coverage gaps.
 *
 * Under `FOUR_WEEK` this always reports a single 14-day overlap. Under
 * `CALENDAR_MONTH` it surfaces the 11–14 day spread, which is the point: the
 * variance is measured rather than assumed away.
 */
export function verifyContinuity(
  anchor: Date,
  fromCycle: number,
  count: number,
  policy: RotationPolicy = DEFAULT_ROTATION_POLICY
): ContinuityReport {
  const plan = rotationPlan(anchor, Math.max(1, fromCycle), count, policy);
  const gaps: number[] = [];
  const overlaps = new Set<number>();

  for (const entry of plan) {
    if (!entry.continuousFromPrevious) gaps.push(entry.cycleIndex);
    overlaps.add(
      Math.round((entry.overlapWithPreviousMs / MS_PER_DAY) * 100) / 100
    );
  }

  return {
    continuous: gaps.length === 0,
    overlapDaysObserved: [...overlaps].sort((a, b) => a - b),
    gapsAtCycles: gaps,
  };
}

/* ── PIN formatting ──────────────────────────────────────────────────────── */

const PIN_PATTERN = /^\d{4}$/;

/**
 * Coerce user input to a comparable 4-digit PIN, or null.
 *
 * Guests type on phones and kiosks, so spaces, dashes and full-width digits
 * from an IME all arrive in practice. Normalising here means the database only
 * ever sees canonical digits.
 */
export function normalizePin(input: string): string | null {
  const halfWidth = input.replace(/[\uFF10-\uFF19]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
  const digitsOnly = halfWidth.replace(/[^\d]/g, "");
  return PIN_PATTERN.test(digitsOnly) ? digitsOnly : null;
}

export function isValidPinFormat(input: string): boolean {
  return normalizePin(input) !== null;
}

/** Lobby codes are uppercase alphanumeric with optional dashes. */
const LOBBY_PATTERN = /^[A-Z0-9-]{4,32}$/;

export function normalizeLobbyCode(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return LOBBY_PATTERN.test(cleaned) ? cleaned : null;
}

/**
 * Total 4-digit PINs, and therefore the hard ceiling on concurrently live
 * codes across the entire platform.
 *
 * The database enforces global uniqueness of overlapping codes, so this is a
 * real capacity limit, not a formality: with two codes live per resort during
 * overlap, the format supports roughly 5 000 simultaneous tenants. Past that,
 * PINs must gain a digit or become tenant-scoped.
 */
export const PIN_KEYSPACE = 10_000;

export function estimateKeyspacePressure(liveCodeCount: number): {
  used: number;
  capacity: number;
  utilization: number;
  severity: "ok" | "watch" | "critical";
} {
  const utilization = liveCodeCount / PIN_KEYSPACE;
  return {
    used: liveCodeCount,
    capacity: PIN_KEYSPACE,
    utilization,
    severity: utilization >= 0.75 ? "critical" : utilization >= 0.4 ? "watch" : "ok",
  };
}

/* ── Human-readable summary ──────────────────────────────────────────────── */

export function describePolicy(
  policy: RotationPolicy = DEFAULT_ROTATION_POLICY
): string {
  if (policy.cadence === "FOUR_WEEK") {
    const overlap = policy.validityDays - CADENCE_DAYS;
    return `New PIN every ${CADENCE_DAYS} days, valid ${policy.validityDays} days, ${overlap}-day overlap.`;
  }
  return `New PIN each calendar month, valid ${policy.validityDays} days, overlap varies 11–14 days with month length.`;
}
