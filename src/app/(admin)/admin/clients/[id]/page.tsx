import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import {
  fetchTenant,
  fetchTenantAccessCodes,
  fetchTenantAssets,
  fetchTenantSensors,
} from "@/lib/data/admin";
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
import { ProvisionSensorForm } from "@/components/admin/ProvisionSensorForm";
import { SensorFleetTable } from "@/components/admin/SensorFleetTable";
import { AccessCodeManager } from "@/components/admin/AccessCodeManager";
import { TwinAssetUploader } from "@/components/admin/TwinAssetUploader";
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatNumber,
  SUBSCRIPTION_LABEL,
  subscriptionTone,
} from "@/lib/format";
import {
  currentCycleIndex,
  DEFAULT_ROTATION_POLICY,
  describePolicy,
  nextRotationAt,
  verifyContinuity,
} from "@/lib/pin-engine";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const tenant = await fetchTenant(params.id);
  return { title: tenant?.name ?? "Resort" };
}

export default async function TenantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const tenant = await fetchTenant(params.id);
  if (!tenant) notFound();

  const [sensors, codes, assets] = await Promise.all([
    fetchTenantSensors(tenant.id),
    fetchTenantAccessCodes(tenant.id),
    fetchTenantAssets(tenant.id),
  ]);

  const now = Date.now();
  const nowDate = new Date(now);
  const anchor = new Date(tenant.created_at);

  const cycle = currentCycleIndex(anchor, nowDate, DEFAULT_ROTATION_POLICY);
  const nextRotation = nextRotationAt(anchor, nowDate, DEFAULT_ROTATION_POLICY);

  // Audit the next year of the schedule. Under the default policy this always
  // reports a single 14-day overlap; surfacing it proves the invariant holds
  // for this tenant's specific anchor rather than asserting it in a comment.
  const continuity = verifyContinuity(anchor, 1, 13, DEFAULT_ROTATION_POLICY);

  const activeSensors = sensors.filter((sensor) => sensor.status !== "retired");
  const publishedAsset = assets.find((asset) => asset.is_published) ?? null;

  return (
    <Page>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 font-sans text-[11px] text-[var(--edl-muted)] transition-colors hover:text-[var(--edl-text)]"
      >
        <ArrowLeft size={12} aria-hidden />
        Estate
      </Link>

      <PageHeader
        title={tenant.name}
        purpose={`Hardware provisioning, digital twin configuration and guest access for ${tenant.slug}.`}
      >
        <Status
          tone={subscriptionTone(tenant.subscription_status)}
          label={SUBSCRIPTION_LABEL[tenant.subscription_status]}
        />
      </PageHeader>

      <MetricRow>
        <Metric
          label="Fleet"
          value={`${activeSensors.length}/${tenant.sensor_quota}`}
          hint="Provisioned against quota"
          tone={activeSensors.length >= tenant.sensor_quota ? "attention" : "positive"}
        />
        <Metric
          label="Current PIN cycle"
          value={cycle < 0 ? "—" : String(cycle)}
          hint={`Next rotation ${formatDate(nextRotation.toISOString())}`}
        />
        <Metric
          label="Overlap"
          value={
            continuity.overlapDaysObserved.length === 1
              ? `${continuity.overlapDaysObserved[0]} days`
              : `${Math.min(...continuity.overlapDaysObserved)}–${Math.max(
                  ...continuity.overlapDaysObserved
                )} days`
          }
          hint={continuity.continuous ? "Coverage is gapless" : "Gap detected"}
          tone={continuity.continuous ? "positive" : "critical"}
        />
        <Metric
          label="Twin asset"
          value={publishedAsset ? `v${publishedAsset.version}` : "None"}
          hint={
            publishedAsset
              ? `${publishedAsset.asset_kind} · ${formatBytes(publishedAsset.file_bytes)}`
              : "Guest view falls back to procedural terrain"
          }
          tone={publishedAsset ? "positive" : "attention"}
        />
        <Metric
          label="Onboarded"
          value={formatDate(tenant.created_at)}
          hint="Anchors the rotation schedule"
        />
      </MetricRow>

      {/* ── Fleet ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Sensor fleet"
          hint="Autonomous bioacoustic balises. Status reflects the last ingest, not a provisioning intent."
        />
        <SensorFleetTable tenantId={tenant.id} sensors={sensors} now={now} />
      </Card>

      <Card>
        <CardHeader
          title="Provision a balise"
          hint="Mints a credential and registers the hardware. The key is shown once."
        />
        <ProvisionSensorForm tenantId={tenant.id} />
      </Card>

      {/* ── Access codes ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Access codes" hint={describePolicy(DEFAULT_ROTATION_POLICY)} />
        <AccessCodeManager
          tenantId={tenant.id}
          lobbyCode={tenant.master_lobby_code}
          lobbyRotatedAt={tenant.master_lobby_code_rotated_at}
          codes={codes}
          now={now}
        />
      </Card>

      {/* ── 3D twin ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Digital twin assets"
          hint="One published version per resort. Uploads go direct to storage, bypassing the app server."
        />

        <div className="px-4 py-1">
          <Table
            head={["Version", "Label", "Kind", "Size", "Origin", "Span", "State", "Uploaded"]}
            empty="No twin asset uploaded. The guest view will render procedural terrain until one is published."
          >
            {assets.map((asset) => (
              <Row key={asset.id}>
                <Cell align="right">v{asset.version}</Cell>
                <Cell>{asset.label}</Cell>
                <Cell mono>{asset.asset_kind}</Cell>
                <Cell align="right">{formatBytes(asset.file_bytes)}</Cell>
                <Cell mono>
                  {asset.origin_lat !== null && asset.origin_lon !== null
                    ? `${asset.origin_lat.toFixed(5)}, ${asset.origin_lon.toFixed(5)}`
                    : "—"}
                </Cell>
                <Cell align="right">
                  {asset.span_meters ? `${asset.span_meters} m` : "—"}
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
                        ? "Published"
                        : asset.processing_status === "ready"
                          ? "Draft"
                          : asset.processing_status
                    }
                  />
                </Cell>
                <Cell align="right">{formatDate(asset.created_at)}</Cell>
              </Row>
            ))}
          </Table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Upload twin asset"
          hint="Photogrammetry mesh, point cloud or heightmap, with its georeferencing envelope."
        />
        <TwinAssetUploader tenantId={tenant.id} />
      </Card>

      {/* ── Configuration ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Configuration" />
        <div className="px-4 py-1">
          <SpecRow label="Resort id" value={tenant.id} mono />
          <SpecRow label="Slug" value={tenant.slug} mono />
          <SpecRow label="Timezone" value={tenant.timezone} />
          <SpecRow
            label="Country"
            value={tenant.country_code ?? "Not set"}
          />
          <SpecRow
            label="Subscription renews"
            value={
              tenant.subscription_renews_at
                ? formatDate(tenant.subscription_renews_at)
                : "Not set"
            }
          />
          <SpecRow
            label="Twin georeferencing"
            hint="Mirrored from the published asset for fast guest reads."
            value={
              tenant.coordinates
                ? `${tenant.coordinates.lat.toFixed(5)}, ${tenant.coordinates.lon.toFixed(
                    5
                  )} · ${tenant.coordinates.headingDeg}° · ${tenant.coordinates.spanMeters} m`
                : "Not set"
            }
            mono
          />
          <SpecRow
            label="Detections retained"
            value={`${formatNumber(codes.length)} code cycles on record`}
          />
          <SpecRow label="Last modified" value={formatDateTime(tenant.updated_at)} />
        </div>
      </Card>

      <p className={TYPE.meta}>
        Rotation policy: {describePolicy(DEFAULT_ROTATION_POLICY)} Verified over the
        next 13 cycles from this resort&apos;s onboarding anchor —{" "}
        {continuity.continuous
          ? "no coverage gaps."
          : `gaps at cycles ${continuity.gapsAtCycles.join(", ")}.`}
      </p>
    </Page>
  );
}
