import Link from "next/link";
import type { Metadata } from "next";
import { fetchEstateOverview } from "@/lib/data/admin";
import {
  Card,
  CardHeader,
  Cell,
  EmptyState,
  Metric,
  MetricRow,
  Page,
  PageHeader,
  Row,
  Status,
  Table,
  TYPE,
} from "@/components/console/ui";
import {
  batteryTone,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelative,
  isPingStale,
  SUBSCRIPTION_LABEL,
  subscriptionTone,
} from "@/lib/format";
import { estimateKeyspacePressure } from "@/lib/pin-engine";

export const metadata: Metadata = { title: "Estate" };

// Fleet health is only meaningful live; a cached page would show a resort as
// healthy minutes after it went dark.
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const estate = await fetchEstateOverview();
  const now = Date.now();

  const totals = estate.reduce(
    (acc, row) => {
      acc.sensors += row.sensors_total;
      acc.active += row.sensors_active;
      acc.degraded += row.sensors_degraded;
      acc.offline += row.sensors_offline;
      acc.detections24h += row.detections?.detections_24h ?? 0;
      acc.awaitingReview += row.detections?.awaiting_review ?? 0;
      if (row.is_active) acc.liveTenants += 1;
      return acc;
    },
    {
      sensors: 0,
      active: 0,
      degraded: 0,
      offline: 0,
      detections24h: 0,
      awaitingReview: 0,
      liveTenants: 0,
    }
  );

  // Two codes are live per resort during the two-week rollover overlap, so the
  // worst-case draw on the shared 4-digit keyspace is twice the tenant count.
  const keyspace = estimateKeyspacePressure(totals.liveTenants * 2);

  const fleetHealth =
    totals.sensors === 0 ? null : totals.active / totals.sensors;

  return (
    <Page>
      <PageHeader
        title="Estate overview"
        purpose="Every contracted resort, its listening fleet and its bioacoustic yield over the last 24 hours."
      />

      <MetricRow>
        <Metric
          label="Resorts live"
          value={formatNumber(totals.liveTenants)}
          hint={`${estate.length} onboarded`}
        />
        <Metric
          label="Balises deployed"
          value={formatNumber(totals.sensors)}
          hint={`${totals.active} active · ${totals.degraded} degraded · ${totals.offline} offline`}
        />
        <Metric
          label="Fleet health"
          value={formatPercent(fleetHealth)}
          hint="Share of units reporting normally"
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
          label="Detections · 24 h"
          value={formatNumber(totals.detections24h)}
          hint={`${formatNumber(totals.awaitingReview)} awaiting review`}
        />
        <Metric
          label="PIN keyspace"
          value={formatPercent(keyspace.utilization, 1)}
          hint={`${formatNumber(keyspace.used)} of ${formatNumber(keyspace.capacity)} 4-digit codes`}
          tone={
            keyspace.severity === "ok"
              ? "positive"
              : keyspace.severity === "watch"
                ? "attention"
                : "critical"
          }
        />
      </MetricRow>

      <Card>
        <CardHeader
          title="Resorts"
          hint="Select a resort to provision hardware, manage its twin asset and review access codes."
        />

        {estate.length === 0 ? (
          <EmptyState
            title="No resorts onboarded yet"
            detail="Create the first tenant to begin provisioning balises and uploading a digital twin. Onboarding issues the resort's lobby code and its first guest PIN cycle."
          />
        ) : (
          <Table
            head={[
              "Resort",
              "Subscription",
              "Fleet",
              "Lowest battery",
              "Last ping",
              "Detections 24 h",
              "Species 30 d",
              "Mean confidence",
            ]}
          >
            {estate.map((row) => {
              const stale = isPingStale(row.last_ping, now);
              const fleetTone =
                row.sensors_offline > 0
                  ? "critical"
                  : row.sensors_degraded > 0
                    ? "attention"
                    : "positive";

              return (
                <Row key={row.tenant_id}>
                  <Cell>
                    <Link
                      href={`/admin/clients/${row.tenant_id}`}
                      className="font-medium text-[var(--bt-text)] underline-offset-2 hover:underline"
                    >
                      {row.tenant_name}
                    </Link>
                    <span className={`ml-2 ${TYPE.meta}`}>{row.tenant_slug}</span>
                  </Cell>

                  <Cell>
                    <Status
                      tone={subscriptionTone(row.subscription_status)}
                      label={SUBSCRIPTION_LABEL[row.subscription_status]}
                    />
                  </Cell>

                  <Cell>
                    <Status
                      tone={fleetTone}
                      label={`${row.sensors_active}/${row.sensors_total} active`}
                    />
                  </Cell>

                  <Cell align="right">
                    <Status
                      tone={batteryTone(row.battery_min)}
                      label={
                        row.battery_min === null ? "—" : `${row.battery_min}%`
                      }
                      className="justify-end"
                    />
                  </Cell>

                  <Cell align="right">
                    <span style={stale ? { color: "var(--bt-danger)" } : undefined}>
                      {formatRelative(row.last_ping, now)}
                    </span>
                  </Cell>

                  <Cell align="right">
                    {formatNumber(row.detections?.detections_24h ?? 0)}
                  </Cell>

                  <Cell align="right">
                    {formatNumber(row.detections?.species_30d ?? 0)}
                  </Cell>

                  <Cell align="right">
                    {formatPercent(row.detections?.confidence_avg_7d ?? null, 1)}
                  </Cell>
                </Row>
              );
            })}
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Access code rotation"
          hint="Guest PINs are issued on a 28-day cadence with 42-day validity, giving every rollover a 14-day overlap."
        />
        <div className="px-4 py-3.5">
          <p className={TYPE.body}>
            Because <code className="font-mono text-[11px]">verify_guest_pin</code>{" "}
            receives four digits and no tenant hint, a live PIN must resolve to
            exactly one resort. The database enforces that with an exclusion
            constraint over{" "}
            <code className="font-mono text-[11px]">(code, validity range)</code>,
            so an ambiguous code cannot be written even if application code tried.
          </p>
          <p className={`mt-2 ${TYPE.meta}`}>
            That makes the 4-digit format a real capacity limit: roughly{" "}
            {formatNumber(Math.floor(keyspace.capacity / 2))} concurrent resorts.
            Current draw is {formatPercent(keyspace.utilization, 1)}.
            {keyspace.severity !== "ok"
              ? " Plan a migration to 5 digits or tenant-scoped PINs before this saturates."
              : ""}
          </p>
          <p className={`mt-2 ${TYPE.meta}`}>
            Generated {formatDateTime(new Date().toISOString())}.
          </p>
        </div>
      </Card>
    </Page>
  );
}
