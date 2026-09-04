import Link from "next/link";
import type { Metadata } from "next";
import { canModule, requireAnyModule, requireErpSession } from "@/lib/auth/erp";
import { currentLocale, messages } from "@/i18n/server";
import { fill } from "@/i18n/console";
import { fetchDomainDirectory, fetchDomains, type DomainRow } from "@/modules/domains/data";
import {
  Card,
  CardHeader,
  Cell,
  EmptyState,
  Page,
  PageHeader,
  Row,
  Status,
  Table,
  TYPE,
} from "@/components/console/ui";
import {
  batteryTone,
  formatNumber,
  formatPercent,
  formatRelative,
  isPingStale,
  subscriptionTone,
} from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messages().modules.domains.label };
}
export const dynamic = "force-dynamic";

export default async function DomainsPage() {
  await requireAnyModule(["domains", "contracts", "invoices"]);
  const session = await requireErpSession();
  const canWrite = canModule(session, "domains", "write");
  const canDomains = canModule(session, "domains");

  const fleet = canDomains ? await fetchDomains() : null;
  const directory = fleet ? null : await fetchDomainDirectory();
  const rows = fleet ?? directory ?? [];
  const copy = messages();
  const locale = currentLocale();
  const now = Date.now();

  return (
    <Page>
      <PageHeader title={copy.modules.domains.label} purpose={copy.modules.domains.purpose}>
        {canWrite ? (
          <Link href="/admin/domains/new" className="console-btn-primary">
            {copy.domains.onboard}
          </Link>
        ) : null}
      </PageHeader>

      <Card>
        <CardHeader
          title={
            rows.length === 1
              ? copy.domains.countOne
              : fill(copy.domains.countMany, { n: rows.length })
          }
          hint={copy.domains.listHint}
        />

        {rows.length === 0 ? (
          <EmptyState
            title={copy.domains.emptyTitle}
            detail={copy.domains.emptyDetail}
            action={
              canWrite ? (
                <Link href="/admin/domains/new" className="console-btn-primary">
                  {copy.domains.onboardFirst}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table
            head={
              canDomains
                ? [
                    copy.domains.colDomain,
                    copy.domains.colSubscription,
                    copy.domains.colFleet,
                    copy.domains.colBattery,
                    copy.domains.colPing,
                    copy.domains.colDetections,
                    copy.domains.colSpecies,
                    copy.domains.colConfidence,
                  ]
                : [copy.domains.colDomain, copy.domains.colSubscription]
            }
          >
            {rows.map((row) => {
              const fleetRow = "sensors_total" in row ? (row as DomainRow) : null;
              const stale = fleetRow ? isPingStale(fleetRow.last_ping, now) : false;
              const fleetTone =
                !fleetRow
                  ? "neutral"
                  : fleetRow.sensors_offline > 0
                    ? "critical"
                    : fleetRow.sensors_degraded > 0
                      ? "attention"
                      : "positive";

              return (
                <Row key={row.tenant_id}>
                  <Cell>
                    <Link
                      href={`/admin/domains/${row.tenant_id}`}
                      className="font-medium text-[var(--edl-text)] underline-offset-2 hover:underline"
                    >
                      {row.tenant_name}
                    </Link>
                    <span className={`ml-2 ${TYPE.meta}`}>{row.tenant_slug}</span>
                  </Cell>

                  <Cell>
                    <Status
                      tone={subscriptionTone(row.subscription_status)}
                      label={copy.labels.subscription[row.subscription_status] ?? row.subscription_status}
                    />
                  </Cell>

                  {fleetRow ? (
                    <>
                      <Cell>
                        <Status
                          tone={fleetTone}
                          label={fill(copy.domains.fleetActive, {
                            active: fleetRow.sensors_active,
                            total: fleetRow.sensors_total,
                          })}
                        />
                      </Cell>

                      <Cell align="right">
                        <Status
                          tone={batteryTone(fleetRow.battery_min)}
                          label={
                            fleetRow.battery_min === null
                              ? copy.empty
                              : `${fleetRow.battery_min}%`
                          }
                          className="justify-end"
                        />
                      </Cell>

                      <Cell align="right">
                        <span style={stale ? { color: "var(--edl-danger)" } : undefined}>
                          {formatRelative(fleetRow.last_ping, now, copy.relative)}
                        </span>
                      </Cell>

                      <Cell align="right">
                        {formatNumber(fleetRow.detections?.detections_24h ?? 0)}
                      </Cell>

                      <Cell align="right">
                        {formatNumber(fleetRow.detections?.species_30d ?? 0)}
                      </Cell>

                      <Cell align="right">
                        {formatPercent(fleetRow.detections?.confidence_avg_7d ?? null, 1)}
                      </Cell>
                    </>
                  ) : null}
                </Row>
              );
            })}
          </Table>
        )}
      </Card>
    </Page>
  );
}
