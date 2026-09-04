import Link from "next/link";
import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/erp";
import { fetchEstateSnapshot } from "@/modules/overview/data";
import {
  Card,
  CardHeader,
  EmptyState,
  Metric,
  MetricRow,
  Page,
  PageHeader,
  Status,
  TYPE,
} from "@/components/console/ui";
import { formatNumber, formatPercent } from "@/lib/format";
import { estimateKeyspacePressure } from "@/lib/pin-engine";
import { messages } from "@/i18n/server";
import { fill } from "@/i18n/console";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messages().modules.overview.label };
}

// Fleet health is only meaningful live; a cached page would show a resort as
// healthy minutes after it went dark.
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  await requireModule("overview");

  const now = Date.now();
  const { summary, attention } = await fetchEstateSnapshot(now);
  const copy = messages();

  // Two codes are live per resort during the two-week rollover overlap, so the
  // worst-case draw on the shared 4-digit keyspace is twice the tenant count.
  const keyspace = estimateKeyspacePressure(summary.domainsLive * 2);

  const fleetHealth =
    summary.sensorsTotal === 0
      ? null
      : summary.sensorsActive / summary.sensorsTotal;

  return (
    <Page>
      <PageHeader title={copy.modules.overview.label} purpose={copy.modules.overview.purpose}>
        <Link href="/admin/domains/new" className="console-btn-primary">
          {copy.overview.onboard}
        </Link>
      </PageHeader>

      <MetricRow>
        <Metric
          label={copy.overview.domainsLive}
          value={formatNumber(summary.domainsLive)}
          hint={fill(copy.overview.domainsLiveHint, {
            total: summary.domainsTotal,
            trial: summary.domainsTrial,
          })}
        />
        <Metric
          label={copy.overview.suspended}
          value={formatNumber(summary.domainsSuspended)}
          hint={copy.overview.suspendedHint}
          tone={summary.domainsSuspended > 0 ? "critical" : "positive"}
        />
        <Metric
          label={copy.overview.balises}
          value={formatNumber(summary.sensorsTotal)}
          hint={fill(copy.overview.balisesHint, {
            active: summary.sensorsActive,
            degraded: summary.sensorsDegraded,
            offline: summary.sensorsOffline,
          })}
        />
        <Metric
          label={copy.overview.fleetHealth}
          value={formatPercent(fleetHealth)}
          hint={copy.overview.fleetHealthHint}
          tone={
            fleetHealth === null
              ? "neutral"
              : fleetHealth >= 0.9
                ? "positive"
                : fleetHealth >= 0.7
                  ? "attention"
                  : "critical"
          }
        />
        <Metric
          label={copy.overview.detections24h}
          value={formatNumber(summary.detections24h)}
          hint={fill(copy.overview.awaitingReview, {
            n: formatNumber(summary.awaitingReview),
          })}
        />
      </MetricRow>

      <Card>
        <CardHeader title={copy.overview.attention} hint={copy.overview.attentionHint} />

        {attention.length === 0 ? (
          <EmptyState
            title={copy.overview.nothingTitle}
            detail={copy.overview.nothingDetail}
          />
        ) : (
          <ul className="divide-y divide-[var(--edl-border)]">
            {attention.map((item, index) => (
              <li
                key={`${item.tenantId}-${index}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
              >
                <Link
                  href={item.href ?? `/admin/domains/${item.tenantId}`}
                  className="min-w-[160px] font-sans text-[12px] font-medium text-[var(--edl-text)] underline-offset-2 hover:underline"
                >
                  {item.tenantName}
                </Link>
                <Status tone={item.tone} label={item.headline} />
                <span className={`${TYPE.meta} flex-1`}>{item.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title={copy.overview.keyspace} hint={copy.overview.keyspaceHint} />
        <div className="px-4 py-3.5">
          <p className={TYPE.body}>{copy.overview.keyspaceBody1}</p>
          <p className={`mt-2 ${TYPE.meta}`}>
            {fill(copy.overview.keyspaceBody2, {
              domains: formatNumber(Math.floor(keyspace.capacity / 2)),
              util: formatPercent(keyspace.utilization, 1),
              capacity: formatNumber(keyspace.capacity),
            })}
            {keyspace.severity !== "ok" ? copy.overview.keyspacePlan : ""}
          </p>
        </div>
      </Card>
    </Page>
  );
}
