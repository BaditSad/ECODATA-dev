import type { Metadata } from "next";
import { requireStaff, canEditTenantSettings } from "@/lib/auth/guards";
import { fetchPortalSnapshot, fetchTnfdReportData } from "@/lib/data/tenant";
import { createReadOnlyServerSupabase } from "@/lib/supabase/server";
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
import { LobbyControls } from "@/components/portal/LobbyControls";
import {
  batteryTone,
  confidenceTone,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelative,
  isPingStale,
  SENSOR_STATUS_LABEL,
  sensorStatusTone,
  signalLabel,
} from "@/lib/format";
import type { SpeciesProfileRow } from "@/types/database";

export const metadata: Metadata = { title: "Resort operations" };
export const dynamic = "force-dynamic";

/** Disclosure periods offered by the report generator. */
const REPORT_PERIODS = [
  { days: 30, label: "30 days" },
  { days: 90, label: "Quarter" },
  { days: 365, label: "Year" },
] as const;

export default async function HotelPortalPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const staff = await requireStaff();

  const requested = Number(searchParams.period);
  const periodDays = REPORT_PERIODS.some((option) => option.days === requested)
    ? requested
    : 90;

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * 86_400_000);

  const [snapshot, report, speciesCatalogue] = await Promise.all([
    fetchPortalSnapshot(staff.tenantId),
    fetchTnfdReportData({ tenantId: staff.tenantId, periodStart, periodEnd }),
    createReadOnlyServerSupabase()
      .from("species_profiles")
      .select("*")
      .order("common_name_en", { ascending: true })
      .limit(200),
  ]);

  const now = Date.now();
  const canEdit = canEditTenantSettings(staff.role);
  const species: SpeciesProfileRow[] = speciesCatalogue.data ?? [];

  const needsAttention = snapshot.sensors.filter(
    (sensor) =>
      sensor.status !== "active" ||
      (sensor.battery_level ?? 100) < 30 ||
      isPingStale(sensor.last_ping, now)
  );

  return (
    <Page>
      <PageHeader
        title={snapshot.tenant.name}
        purpose="Listening network health, guest access codes, hall display control and TNFD disclosure evidence."
      />

      <MetricRow>
        <Metric
          label="Balises reporting"
          value={`${snapshot.fleet?.sensors_active ?? 0}/${
            snapshot.fleet?.sensors_total ?? 0
          }`}
          hint={
            needsAttention.length === 0
              ? "No field visit needed"
              : `${needsAttention.length} need attention`
          }
          tone={needsAttention.length === 0 ? "positive" : "attention"}
        />
        <Metric
          label="Detections · 24 h"
          value={formatNumber(snapshot.detections?.detections_24h ?? 0)}
          hint={`${formatNumber(snapshot.detections?.detections_7d ?? 0)} over 7 days`}
        />
        <Metric
          label="Species · 30 d"
          value={formatNumber(snapshot.detections?.species_30d ?? 0)}
          hint="Distinct species identified"
        />
        <Metric
          label="Mean confidence"
          value={formatPercent(snapshot.detections?.confidence_avg_7d ?? null, 1)}
          hint={`${formatNumber(
            snapshot.detections?.awaiting_review ?? 0
          )} calls awaiting review`}
        />
        <Metric
          label="Guest codes live"
          value={String(snapshot.activeCodes.length)}
          hint={
            snapshot.activeCodes.length > 1
              ? "Inside the rollover overlap"
              : "Single active cycle"
          }
          tone={snapshot.activeCodes.length === 0 ? "critical" : "positive"}
        />
      </MetricRow>

      {/* ── Guest access ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Guest access codes"
          hint="Give arriving guests the code that expires latest. During a rollover both codes work, so a guest who already has the older one is never turned away."
        />
        <div className="px-4 py-1">
          {snapshot.activeCodes.length === 0 ? (
            <p className="py-6 text-center font-sans text-[12px]" style={{ color: "var(--bt-danger)" }}>
              No guest code is currently live. Contact platform support — guests
              cannot sign in until a code is issued.
            </p>
          ) : (
            snapshot.activeCodes.map((code, index) => (
              <SpecRow
                key={code.id}
                label={index === 0 ? "Current code" : "Incoming code"}
                hint={`Cycle ${code.cycle_index} · valid until ${formatDate(
                  code.valid_until
                )}`}
              >
                <span className="font-mono text-[16px] tracking-[0.18em] text-[var(--bt-text)]">
                  {code.code}
                </span>
              </SpecRow>
            ))
          )}
          <SpecRow
            label="Lobby display code"
            hint="Permanent. Used once per screen when pairing."
            value={snapshot.tenant.master_lobby_code}
            mono
          />
        </div>
      </Card>

      {/* ── Fleet ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Listening network"
          hint="Battery figures follow the LiFePO4 discharge curve, which stays flat until it drops sharply — schedule a visit at 30%, not 10%."
        />
        <Table
          head={["Unit", "Status", "Battery", "Solar", "Signal", "Last ping"]}
          empty="No balises installed at this resort yet."
        >
          {snapshot.sensors.map((sensor) => {
            const stale = isPingStale(sensor.last_ping, now);
            const signal = signalLabel(sensor.signal_rssi_dbm);

            return (
              <Row key={sensor.id}>
                <Cell>
                  <span className="font-medium text-[var(--bt-text)]">
                    {sensor.name}
                  </span>
                </Cell>
                <Cell>
                  <Status
                    tone={sensorStatusTone(sensor.status)}
                    label={SENSOR_STATUS_LABEL[sensor.status]}
                  />
                </Cell>
                <Cell align="right">
                  <Status
                    tone={batteryTone(sensor.battery_level)}
                    label={
                      sensor.battery_level === null
                        ? "—"
                        : `${sensor.battery_level}%`
                    }
                    className="justify-end"
                  />
                </Cell>
                <Cell align="right">
                  {sensor.solar_input_mv === null
                    ? "—"
                    : `${(sensor.solar_input_mv / 1000).toFixed(2)} V`}
                </Cell>
                <Cell>
                  <Status tone={signal.tone} label={signal.label} />
                </Cell>
                <Cell align="right">
                  <span style={stale ? { color: "var(--bt-danger)" } : undefined}>
                    {formatRelative(sensor.last_ping, now)}
                  </span>
                </Cell>
              </Row>
            );
          })}
        </Table>
      </Card>

      {/* ── Lobby control ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Hall display"
          hint={
            snapshot.featuredSpecies
              ? `Currently featuring ${snapshot.featuredSpecies.common_name_en}.`
              : "Currently rotating through recent detections."
          }
        />
        <LobbyControls
          settings={snapshot.lobbySettings}
          species={species}
          canEdit={canEdit}
        />
      </Card>

      {/* ── Recent detections ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Recent detections"
          hint="Calls below 70% confidence are withheld from guests automatically."
        />
        <Table
          head={["Species", "Confidence", "Review", "Detected"]}
          empty="No detections recorded yet."
        >
          {snapshot.recentDetections.map((detection) => (
            <Row key={detection.id}>
              <Cell>
                <span className="font-medium text-[var(--bt-text)]">
                  {detection.species_name}
                </span>
                {detection.latin_name ? (
                  <span className={`ml-2 italic ${TYPE.meta}`}>
                    {detection.latin_name}
                  </span>
                ) : null}
              </Cell>
              <Cell align="right">
                <Status
                  tone={confidenceTone(detection.confidence_score)}
                  label={formatPercent(detection.confidence_score, 0)}
                  className="justify-end"
                />
              </Cell>
              <Cell>
                <Status
                  tone={
                    detection.review_state === "confirmed"
                      ? "positive"
                      : detection.review_state === "rejected"
                        ? "critical"
                        : "neutral"
                  }
                  label={detection.review_state}
                />
              </Cell>
              <Cell align="right">
                {formatRelative(detection.detected_at, now)}
              </Cell>
            </Row>
          ))}
        </Table>
      </Card>

      {/* ── TNFD report ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="TNFD disclosure evidence"
          hint={`${formatDate(report.periodStart)} to ${formatDate(
            report.periodEnd
          )}. Detections an operator rejected are excluded from this evidence base.`}
        >
          <span className="inline-flex rounded-md border border-[var(--bt-border)] bg-[var(--bt-soft)] p-[3px]">
            {REPORT_PERIODS.map((option) => {
              const active = option.days === periodDays;
              return (
                <a
                  key={option.days}
                  href={`/hotel-portal?period=${option.days}`}
                  className="rounded-[5px] px-2.5 py-1 font-sans text-[12px] transition-colors"
                  style={
                    active
                      ? {
                          background: "var(--bt-card)",
                          color: "var(--bt-text)",
                          fontWeight: 500,
                        }
                      : { color: "var(--bt-muted)" }
                  }
                >
                  {option.label}
                </a>
              );
            })}
          </span>
        </CardHeader>

        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--bt-border)] sm:grid-cols-4 sm:divide-y-0">
          <Metric
            label="Total detections"
            value={formatNumber(report.totalDetections)}
            hint="Evidence records in period"
          />
          <Metric
            label="Species richness"
            value={formatNumber(report.species.length)}
            hint="Distinct species detected"
          />
          <Metric
            label="Monitoring coverage"
            value={formatPercent(report.coverageRatio, 0)}
            hint="Days with at least one detection"
            tone={
              report.coverageRatio >= 0.9
                ? "positive"
                : report.coverageRatio >= 0.6
                  ? "attention"
                  : "critical"
            }
          />
          <Metric
            label="Sensors in scope"
            value={formatNumber(report.monitoredSensors)}
            hint="Active listening units"
          />
        </div>

        <Table
          head={[
            "Species",
            "Latin name",
            "Detections",
            "Units",
            "Mean confidence",
            "First",
            "Last",
          ]}
          empty="No detections in this period, so there is no evidence base to disclose."
        >
          {report.species.map((line) => (
            <Row key={line.speciesName}>
              <Cell>
                <span className="font-medium text-[var(--bt-text)]">
                  {line.speciesName}
                </span>
              </Cell>
              <Cell className="italic">{line.latinName ?? "—"}</Cell>
              <Cell align="right">{formatNumber(line.detections)}</Cell>
              <Cell align="right">{line.sensorsInvolved}</Cell>
              <Cell align="right">
                {formatPercent(line.averageConfidence, 1)}
              </Cell>
              <Cell align="right">{formatDate(line.firstDetectedAt)}</Cell>
              <Cell align="right">{formatDate(line.lastDetectedAt)}</Cell>
            </Row>
          ))}
        </Table>
      </Card>

      <p className={TYPE.meta}>
        Generated {formatDateTime(new Date().toISOString())} for{" "}
        {snapshot.tenant.name}. Coverage is the share of days in the period with
        at least one detection — a low figure usually means a hardware gap
        rather than an absence of wildlife.
      </p>
    </Page>
  );
}
