import "server-only";

import { createReadOnlyServerSupabase } from "@/lib/supabase/server";
import { isPingStale } from "@/lib/format";
import type { Tone } from "@/components/console/ui";
import { messages } from "@/i18n/server";
import { fill } from "@/i18n/console";

/**
 * Overview module — reads.
 *
 * Aggregates the estate rather than listing it: the per-resort table belongs
 * to Domains. Queries the fleet views directly instead of borrowing another
 * module's data layer, so the two can diverge without one breaking the other.
 */

export interface EstateSummary {
  domainsTotal: number;
  domainsLive: number;
  domainsSuspended: number;
  domainsTrial: number;
  sensorsTotal: number;
  sensorsActive: number;
  sensorsDegraded: number;
  sensorsOffline: number;
  detections24h: number;
  awaitingReview: number;
}

export interface AttentionItem {
  tenantId: string;
  tenantName: string;
  headline: string;
  detail: string;
  tone: Tone;
  href?: string;
}

export interface EstateSnapshot {
  summary: EstateSummary;
  attention: AttentionItem[];
}

/** Above this, a review backlog is a staffing problem rather than a queue. */
const REVIEW_BACKLOG_THRESHOLD = 50;

export async function fetchEstateSnapshot(now: number): Promise<EstateSnapshot> {
  const supabase = createReadOnlyServerSupabase();
  const t = messages();

  const [fleet, rollup, contracts, invoices, workTickets, incidents] = await Promise.all([
    supabase
      .from("tenant_fleet_overview")
      .select("*")
      .order("tenant_name", { ascending: true }),
    supabase.from("tenant_detection_rollup").select("*"),
    supabase
      .from("contracts")
      .select("tenant_id, ends_on, status, tenants(name)")
      .eq("status", "active"),
    supabase
      .from("invoices")
      .select("tenant_id, number, due_on, status, tenants(name)")
      .eq("status", "issued"),
    supabase
      .from("work_tickets")
      .select("id, title, status")
      .in("status", ["waiting", "in_progress"]),
    supabase
      .from("hotel_incidents")
      .select("id, tenant_id, title, status, tenants(name)")
      .in("status", ["open", "in_progress"]),
  ]);

  if (fleet.error) throw new Error(`Fleet overview failed: ${fleet.error.message}`);
  if (rollup.error) throw new Error(`Detection rollup failed: ${rollup.error.message}`);
  if (contracts.error) throw new Error(`Contract scan failed: ${contracts.error.message}`);
  if (invoices.error) throw new Error(`Invoice scan failed: ${invoices.error.message}`);
  if (workTickets.error) throw new Error(`Ticket scan failed: ${workTickets.error.message}`);
  if (incidents.error) throw new Error(`Incident scan failed: ${incidents.error.message}`);

  const rows = fleet.data ?? [];
  const detectionsByTenant = new Map(
    (rollup.data ?? []).map((row) => [row.tenant_id, row])
  );

  const summary: EstateSummary = {
    domainsTotal: rows.length,
    domainsLive: 0,
    domainsSuspended: 0,
    domainsTrial: 0,
    sensorsTotal: 0,
    sensorsActive: 0,
    sensorsDegraded: 0,
    sensorsOffline: 0,
    detections24h: 0,
    awaitingReview: 0,
  };

  const attention: AttentionItem[] = [];

  for (const row of rows) {
    const detections = detectionsByTenant.get(row.tenant_id) ?? null;

    if (row.is_active) summary.domainsLive += 1;
    if (row.subscription_status === "suspended") summary.domainsSuspended += 1;
    if (row.subscription_status === "trial") summary.domainsTrial += 1;

    summary.sensorsTotal += row.sensors_total;
    summary.sensorsActive += row.sensors_active;
    summary.sensorsDegraded += row.sensors_degraded;
    summary.sensorsOffline += row.sensors_offline;
    summary.detections24h += detections?.detections_24h ?? 0;
    summary.awaitingReview += detections?.awaiting_review ?? 0;

    const base = { tenantId: row.tenant_id, tenantName: row.tenant_name };

    if (row.subscription_status === "suspended") {
      attention.push({
        ...base,
        headline: t.overview.attSuspended,
        detail: t.overview.attSuspendedDetail,
        tone: "critical",
      });
    } else if (row.sensors_total === 0) {
      attention.push({
        ...base,
        headline: t.overview.attNoBalises,
        detail: t.overview.attNoBalisesDetail,
        tone: "attention",
      });
    } else if (row.sensors_offline > 0) {
      attention.push({
        ...base,
        headline: fill(
          row.sensors_offline === 1 ? t.overview.attOffline : t.overview.attOfflinePlural,
          { n: row.sensors_offline }
        ),
        detail: t.overview.attOfflineDetail,
        tone: "critical",
      });
    } else if (isPingStale(row.last_ping, now)) {
      attention.push({
        ...base,
        headline: t.overview.attQuiet,
        detail: t.overview.attQuietDetail,
        tone: "attention",
      });
    }

    if ((detections?.awaiting_review ?? 0) > REVIEW_BACKLOG_THRESHOLD) {
      attention.push({
        ...base,
        headline: fill(t.overview.attReview, { n: detections?.awaiting_review ?? 0 }),
        detail: t.overview.attReviewDetail,
        tone: "attention",
      });
    }
  }

  const today = new Date(now).toISOString().slice(0, 10);
  const inThirty = new Date(now + 30 * 86_400_000).toISOString().slice(0, 10);

  function embedName(
    tenants: { name: string } | { name: string }[] | null
  ): string {
    if (!tenants) return t.overview.aDomain;
    return Array.isArray(tenants) ? tenants[0]?.name ?? t.overview.aDomain : tenants.name;
  }

  for (const row of contracts.data ?? []) {
    if (row.ends_on <= inThirty) {
      attention.push({
        tenantId: row.tenant_id,
        tenantName: embedName(
          row.tenants as { name: string } | { name: string }[] | null
        ),
        headline: row.ends_on < today ? t.overview.attContractExpired : t.overview.attContractEnding,
        detail: fill(t.overview.attContractDetail, { date: row.ends_on }),
        tone: row.ends_on < today ? "critical" : "attention",
      });
    }
  }

  for (const row of invoices.data ?? []) {
    if (row.due_on < today) {
      attention.push({
        tenantId: row.tenant_id,
        tenantName: embedName(
          row.tenants as { name: string } | { name: string }[] | null
        ),
        headline: fill(t.overview.attInvoiceOverdue, { number: row.number }),
        detail: fill(t.overview.attInvoiceDetail, { date: row.due_on }),
        tone: "critical",
      });
    }
  }

  for (const row of workTickets.data ?? []) {
    attention.push({
      tenantId: row.id,
      tenantName: t.overview.internal,
      headline: t.overview.attOpenTicket,
      detail: row.title,
      tone: "attention",
      href: "/admin/tickets",
    });
  }

  for (const row of incidents.data ?? []) {
    attention.push({
      tenantId: row.tenant_id,
      tenantName: embedName(
        row.tenants as { name: string } | { name: string }[] | null
      ),
      headline: t.overview.attIncident,
      detail: row.title,
      tone: "attention",
      href: "/admin/incidents",
    });
  }

  // Blocking problems first; within a tone, alphabetical by the resort name
  // the query already ordered on.
  const rank: Record<Tone, number> = {
    critical: 0,
    attention: 1,
    positive: 2,
    neutral: 3,
  };
  attention.sort((a, b) => rank[a.tone] - rank[b.tone]);

  return { summary, attention };
}
