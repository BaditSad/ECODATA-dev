import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { canModule, requireAnyModule } from "@/lib/auth/erp";
import {
  fetchDomain,
  fetchDomainAccessCodes,
  fetchDomainAssets,
  fetchDomainSensors,
} from "@/modules/domains/data";
import { fetchContractsForTenant } from "@/modules/contracts/data";
import { fetchInvoicesForTenant } from "@/modules/invoices/data";
import { ContractSection } from "@/modules/contracts/components/ContractSection";
import { InvoiceSection } from "@/modules/invoices/components/InvoiceSection";
import {
  Card,
  CardHeader,
  Cell,
  Metric,
  MetricRow,
  Page,
  PageHeader,
  Row,
  SpecRow,
  Status,
  Table,
  TYPE,
} from "@/components/console/ui";
import { ProvisionSensorForm } from "@/modules/domains/components/ProvisionSensorForm";
import { SensorFleetTable } from "@/modules/domains/components/SensorFleetTable";
import { AccessCodeManager } from "@/modules/domains/components/AccessCodeManager";
import { TwinAssetUploader } from "@/modules/domains/components/TwinAssetUploader";
import { DomainLifecycle } from "@/modules/domains/components/DomainLifecycle";
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  subscriptionTone,
} from "@/lib/format";
import {
  currentCycleIndex,
  DEFAULT_ROTATION_POLICY,
  nextRotationAt,
  verifyContinuity,
} from "@/lib/pin-engine";
import { currentLocale, messages } from "@/i18n/server";
import { fill } from "@/i18n/console";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const tenant = await fetchDomain(params.id);
  return { title: tenant?.name ?? messages().modules.domains.label };
}

export default async function DomainDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAnyModule(["domains", "contracts", "invoices"]);
  const canDomains = canModule(session, "domains");
  const canWriteDomains = canModule(session, "domains", "write");
  const canContracts = canModule(session, "contracts");
  const canWriteContracts = canModule(session, "contracts", "write");
  const canInvoices = canModule(session, "invoices");
  const canWriteInvoices = canModule(session, "invoices", "write");

  const tenant = await fetchDomain(params.id);
  if (!tenant) notFound();

  const copy = messages();
  const locale = currentLocale();
  const now = Date.now();
  const nowDate = new Date(now);
  const anchor = new Date(tenant.created_at);

  const [contracts, invoices, sensors, codes, assets] = await Promise.all([
    canContracts || canWriteInvoices
      ? fetchContractsForTenant(tenant.id)
      : Promise.resolve([]),
    canInvoices ? fetchInvoicesForTenant(tenant.id) : Promise.resolve([]),
    canDomains ? fetchDomainSensors(tenant.id) : Promise.resolve([]),
    canDomains ? fetchDomainAccessCodes(tenant.id) : Promise.resolve([]),
    canDomains ? fetchDomainAssets(tenant.id) : Promise.resolve([]),
  ]);

  const cycle = currentCycleIndex(anchor, nowDate, DEFAULT_ROTATION_POLICY);
  const nextRotation = nextRotationAt(anchor, nowDate, DEFAULT_ROTATION_POLICY);
  const continuity = verifyContinuity(anchor, 1, 13, DEFAULT_ROTATION_POLICY);

  const activeSensors = sensors.filter((sensor) => sensor.status !== "retired");
  const publishedAsset = assets.find((asset) => asset.is_published) ?? null;
  const liveContract = contracts.find((contract) => contract.status === "active");
  const openInvoices = invoices.filter((invoice) => invoice.status === "issued");
  const overdueInvoices = openInvoices.filter(
    (invoice) => new Date(`${invoice.due_on}T00:00:00Z`).getTime() < now
  );

  const kindLabel = (kind: string) =>
    kind === "glb"
      ? copy.twin.kindGlb
      : kind === "gltf"
        ? copy.twin.kindGltf
        : kind === "point_cloud"
          ? copy.twin.kindPointCloud
          : kind === "heightmap"
            ? copy.twin.kindHeightmap
            : kind;

  const purpose = canDomains
    ? fill(copy.domains.purposeFull, { slug: tenant.slug })
    : fill(copy.domains.purposeCommercial, { slug: tenant.slug });

  const overlapValue =
    continuity.overlapDaysObserved.length === 1
      ? fill(copy.domains.overlapDays, { n: continuity.overlapDaysObserved[0] ?? 0 })
      : fill(copy.domains.overlapDays, {
          n: `${Math.min(...continuity.overlapDaysObserved)}-${Math.max(
            ...continuity.overlapDaysObserved
          )}`,
        });

  return (
    <Page>
      <Link
        href="/admin/domains"
        className="inline-flex items-center gap-1.5 font-sans text-[11px] text-[var(--edl-muted)] transition-colors hover:text-[var(--edl-text)]"
      >
        <ArrowLeft size={12} aria-hidden />
        {copy.domains.backToList}
      </Link>

      <PageHeader title={tenant.name} purpose={purpose}>
        <Status
          tone={subscriptionTone(tenant.subscription_status)}
          label={copy.labels.subscription[tenant.subscription_status] ?? tenant.subscription_status}
        />
      </PageHeader>

      {canContracts || canInvoices ? (
        <MetricRow>
          {canContracts ? (
            <Metric
              label={copy.domains.liveContract}
              value={
                liveContract
                  ? formatMoney(liveContract.amount_cents, liveContract.currency)
                  : copy.none
              }
              hint={
                liveContract
                  ? fill(copy.domains.renews, { date: formatDate(liveContract.ends_on, locale) })
                  : copy.domains.openTerm
              }
              tone={liveContract ? "positive" : "attention"}
            />
          ) : null}
          {canInvoices ? (
            <>
              <Metric
                label={copy.domains.openInvoices}
                value={String(openInvoices.length)}
                hint={fill(copy.domains.overdueN, { n: overdueInvoices.length })}
                tone={overdueInvoices.length > 0 ? "critical" : "neutral"}
              />
              <Metric
                label={copy.domains.receivable}
                value={formatMoney(
                  openInvoices.reduce(
                    (sum, invoice) =>
                      sum + invoice.amount_cents + invoice.tax_cents,
                    0
                  )
                )}
                hint={copy.domains.issuedUnpaid}
              />
            </>
          ) : null}
        </MetricRow>
      ) : null}

      {canContracts ? (
        <ContractSection
          tenantId={tenant.id}
          contracts={contracts}
          canWrite={canWriteContracts}
        />
      ) : null}

      {canInvoices ? (
        <InvoiceSection
          invoices={invoices}
          contracts={contracts}
          canWrite={canWriteInvoices}
          now={now}
        />
      ) : null}

      {canDomains ? (
        <>
          <MetricRow>
            <Metric
              label={copy.domains.fleet}
              value={`${activeSensors.length}/${tenant.sensor_quota}`}
              hint={copy.domains.fleetHint}
              tone={
                activeSensors.length >= tenant.sensor_quota
                  ? "attention"
                  : "positive"
              }
            />
            <Metric
              label={copy.domains.pinCycle}
              value={cycle < 0 ? copy.empty : String(cycle)}
              hint={fill(copy.domains.nextRotation, {
                date: formatDate(nextRotation.toISOString(), locale),
              })}
            />
            <Metric
              label={copy.domains.overlap}
              value={overlapValue}
              hint={continuity.continuous ? copy.domains.coverageOk : copy.domains.coverageGap}
              tone={continuity.continuous ? "positive" : "critical"}
            />
            <Metric
              label={copy.domains.twinAsset}
              value={publishedAsset ? `v${publishedAsset.version}` : copy.none}
              hint={
                publishedAsset
                  ? `${kindLabel(publishedAsset.asset_kind)} · ${formatBytes(publishedAsset.file_bytes)}`
                  : copy.domains.twinFallback
              }
              tone={publishedAsset ? "positive" : "attention"}
            />
            <Metric
              label={copy.domains.onboarded}
              value={formatDate(tenant.created_at, locale)}
              hint={copy.domains.onboardedHint}
            />
          </MetricRow>

          <Card>
            <CardHeader
              title={copy.domains.sensorFleet}
              hint={copy.domains.sensorFleetHint}
            />
            <SensorFleetTable
              tenantId={tenant.id}
              sensors={sensors}
              now={now}
              canWrite={canWriteDomains}
            />
          </Card>

          {canWriteDomains ? (
            <Card>
              <CardHeader
                title={copy.domains.provision}
                hint={copy.domains.provisionHint}
              />
              <ProvisionSensorForm tenantId={tenant.id} />
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title={copy.domains.accessCodes}
              hint={copy.domains.accessCodesHint}
            />
            <AccessCodeManager
              tenantId={tenant.id}
              lobbyCode={tenant.master_lobby_code}
              lobbyRotatedAt={tenant.master_lobby_code_rotated_at}
              codes={codes}
              now={now}
              canWrite={canWriteDomains}
            />
          </Card>

          <Card>
            <CardHeader title={copy.domains.twinTitle} hint={copy.domains.twinHint} />

            <div className="px-4 py-1">
              <Table
                head={[
                  copy.domains.colVersion,
                  copy.domains.colLabel,
                  copy.domains.colKind,
                  copy.domains.colSize,
                  copy.domains.colOrigin,
                  copy.domains.colSpan,
                  copy.domains.colState,
                  copy.domains.colUploaded,
                ]}
                empty={copy.domains.twinEmpty}
              >
                {assets.map((asset) => (
                  <Row key={asset.id}>
                    <Cell align="right">v{asset.version}</Cell>
                    <Cell>{asset.label}</Cell>
                    <Cell>{kindLabel(asset.asset_kind)}</Cell>
                    <Cell align="right">{formatBytes(asset.file_bytes)}</Cell>
                    <Cell mono>
                      {asset.origin_lat !== null && asset.origin_lon !== null
                        ? `${asset.origin_lat.toFixed(5)}, ${asset.origin_lon.toFixed(5)}`
                        : copy.empty}
                    </Cell>
                    <Cell align="right">
                      {asset.span_meters ? `${asset.span_meters} m` : copy.empty}
                    </Cell>
                    <Cell>
                      <Status
                        tone={
                          asset.is_published
                            ? "positive"
                            : asset.processing_status === "failed"
                              ? "critical"
                              : "neutral"
                        }
                        label={
                          asset.is_published
                            ? copy.domains.published
                            : asset.processing_status === "ready"
                              ? copy.domains.draft
                              : copy.labels.assetProcessing[asset.processing_status] ??
                                asset.processing_status
                        }
                      />
                    </Cell>
                    <Cell align="right">{formatDate(asset.created_at, locale)}</Cell>
                  </Row>
                ))}
              </Table>
            </div>
          </Card>

          {canWriteDomains ? (
            <Card>
              <CardHeader title={copy.twin.upload} hint={copy.domains.twinHint} />
              <TwinAssetUploader tenantId={tenant.id} />
            </Card>
          ) : null}

          <Card>
            <CardHeader title={copy.domains.config} />
            <div className="px-4 py-1">
              <SpecRow label={copy.domains.resortId} value={tenant.id} mono />
              <SpecRow label={copy.domains.slug} value={tenant.slug} mono />
              <SpecRow label={copy.domains.timezone} value={tenant.timezone} />
              <SpecRow
                label={copy.domains.country}
                value={tenant.country_code ?? copy.domains.notSet}
              />
              <SpecRow
                label={copy.domains.subRenews}
                value={
                  tenant.subscription_renews_at
                    ? formatDate(tenant.subscription_renews_at, locale)
                    : copy.domains.notSet
                }
              />
              <SpecRow
                label={copy.domains.geo}
                hint={copy.domains.geoHint}
                value={
                  tenant.coordinates
                    ? `${tenant.coordinates.lat.toFixed(5)}, ${tenant.coordinates.lon.toFixed(
                        5
                      )} · ${tenant.coordinates.headingDeg}° · ${tenant.coordinates.spanMeters} m`
                    : copy.domains.notSet
                }
                mono
              />
              <SpecRow
                label={copy.domains.detectionsKept}
                value={formatNumber(codes.length)}
              />
              <SpecRow
                label={copy.domains.lastModified}
                value={formatDateTime(tenant.updated_at, locale)}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title={copy.domains.lifecycle}
              hint={copy.domains.lifecycleHint}
            />
            <DomainLifecycle
              tenantId={tenant.id}
              slug={tenant.slug}
              isActive={tenant.is_active}
              suspendedAt={tenant.suspended_at}
              suspensionReason={tenant.suspension_reason}
              canWrite={canWriteDomains}
              isOwner={session.isOwner}
            />
          </Card>

          <p className={TYPE.meta}>
            {fill(copy.domains.pinForecastBody, {
              n: 13,
              anchor: formatDate(tenant.created_at, locale),
            })}
          </p>
        </>
      ) : null}
    </Page>
  );
}
