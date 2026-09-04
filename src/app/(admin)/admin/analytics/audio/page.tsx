import Link from "next/link";
import type { Metadata } from "next";
import { fetchAudioAnalytics } from "@/lib/data/admin";
import {
  Card,
  CardHeader,
  Cell,
  Metric,
  MetricRow,
  Page,
  PageHeader,
  Row,
  Status,
  Table,
  TYPE,
} from "@/components/console/ui";
import { ConfidenceHistogram } from "@/components/admin/audio/ConfidenceHistogram";
import { ThroughputChart } from "@/components/admin/audio/ThroughputChart";
import { AudioReviewPanel } from "@/components/admin/audio/AudioReviewPanel";
import type { SpectrogramClip } from "@/components/admin/audio/SpectrogramPlayer";
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { MlJobStatus } from "@/types/database";

export const metadata: Metadata = { title: "Audio & AI pipeline" };
export const dynamic = "force-dynamic";

/** Selectable observation windows, in hours. */
const WINDOWS = [
  { hours: 6, label: "6 h" },
  { hours: 24, label: "24 h" },
  { hours: 72, label: "3 d" },
  { hours: 168, label: "7 d" },
] as const;

const DEFAULT_WINDOW_HOURS = 24;

function jobTone(status: MlJobStatus) {
  switch (status) {
    case "succeeded":
      return "positive" as const;
    case "processing":
    case "queued":
      return "attention" as const;
    case "failed":
    case "dead_letter":
      return "critical" as const;
  }
}

export default async function AudioAnalyticsPage({
  searchParams,
}: {
  searchParams: { window?: string };
}) {
  const requested = Number(searchParams.window);
  const windowHours = WINDOWS.some((option) => option.hours === requested)
    ? requested
    : DEFAULT_WINDOW_HOURS;

  const since = new Date(Date.now() - windowHours * 3_600_000);

  const analytics = await fetchAudioAnalytics({ since, detectionLimit: 40 });
  const { summary, histogram, throughput, recentDetections, queue, ingestFailures } =
    analytics;

  const clips: SpectrogramClip[] = recentDetections.map((detection) => ({
    id: detection.id,
    speciesName: detection.species_name,
    latinName: detection.latin_name,
    confidence: detection.confidence_score,
    detectedAt: detection.detected_at,
    sensorName: detection.sensor_name,
    tenantName: detection.tenant_name,
    audioUrl: detection.audio_signed_url,
    spectrogramUrl: detection.spectrogram_signed_url,
    durationMs: detection.clip_duration_ms,
    freqLowHz: detection.freq_low_hz,
    freqHighHz: detection.freq_high_hz,
    modelVersion: detection.model_version,
  }));

  // Precision measured only over calls an operator actually adjudicated;
  // dividing by all detections would understate it by counting the unreviewed.
  const precision =
    summary.detections_reviewed > 0
      ? summary.detections_confirmed / summary.detections_reviewed
      : null;

  const ingestTotal = summary.ingest_accepted + summary.ingest_rejected;
  const rejectionRate =
    ingestTotal > 0 ? summary.ingest_rejected / ingestTotal : null;

  return (
    <Page>
      <PageHeader
        title="Audio & AI pipeline"
        purpose={`Ingestion throughput, model confidence and clip-level review across the whole estate over the last ${
          WINDOWS.find((option) => option.hours === windowHours)?.label ?? "24 h"
        }.`}
      >
        <span className="inline-flex rounded-md border border-[var(--bt-border)] bg-[var(--bt-soft)] p-[3px]">
          {WINDOWS.map((option) => {
            const active = option.hours === windowHours;
            return (
              <Link
                key={option.hours}
                href={`/admin/analytics/audio?window=${option.hours}`}
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
              </Link>
            );
          })}
        </span>
      </PageHeader>

      {/* ── Headline AI metrics ───────────────────────────────────────────── */}
      <MetricRow>
        <Metric
          label="Detections"
          value={formatNumber(summary.detections_total)}
          hint={`${formatNumber(summary.distinct_species)} distinct species`}
        />
        <Metric
          label="Mean confidence"
          value={formatPercent(summary.confidence_avg, 1)}
          hint={`p50 ${formatPercent(summary.confidence_p50, 0)} · p95 ${formatPercent(
            summary.confidence_p95,
            0
          )}`}
          tone={
            summary.confidence_avg === null
              ? "neutral"
              : summary.confidence_avg >= 0.85
                ? "positive"
                : summary.confidence_avg >= 0.7
                  ? "attention"
                  : "critical"
          }
        />
        <Metric
          label="Auto-publish share"
          value={formatPercent(summary.high_confidence_share, 1)}
          hint="Calls at ≥ 0.85, shown to guests unreviewed"
        />
        <Metric
          label="Review precision"
          value={precision === null ? "—" : formatPercent(precision, 1)}
          hint={
            summary.detections_reviewed === 0
              ? "Nothing adjudicated yet"
              : `${formatNumber(summary.detections_confirmed)} confirmed of ${formatNumber(
                  summary.detections_reviewed
                )} reviewed`
          }
          tone={
            precision === null
              ? "neutral"
              : precision >= 0.9
                ? "positive"
                : precision >= 0.75
                  ? "attention"
                  : "critical"
          }
        />
        <Metric
          label="Audio ingested"
          value={formatBytes(summary.ingest_bytes)}
          hint={`${summary.audio_minutes.toFixed(1)} minutes classified`}
        />
      </MetricRow>

      {/* ── Pipeline health ───────────────────────────────────────────────── */}
      <MetricRow>
        <Metric
          label="Queue depth"
          value={formatNumber(summary.jobs_queued)}
          hint="Clips awaiting inference"
          tone={
            summary.jobs_queued > 500
              ? "critical"
              : summary.jobs_queued > 100
                ? "attention"
                : "positive"
          }
        />
        <Metric
          label="In flight"
          value={formatNumber(summary.jobs_processing)}
          hint="Leased to a worker"
        />
        <Metric
          label="Failed jobs"
          value={formatNumber(summary.jobs_failed)}
          hint="Includes dead-lettered"
          tone={summary.jobs_failed > 0 ? "critical" : "positive"}
        />
        <Metric
          label="Ingest accepted"
          value={formatNumber(summary.ingest_accepted)}
          hint={`${formatNumber(summary.ingest_rejected)} rejected`}
        />
        <Metric
          label="Rejection rate"
          value={rejectionRate === null ? "—" : formatPercent(rejectionRate, 1)}
          hint="Auth, payload and quota failures"
          tone={
            rejectionRate === null
              ? "neutral"
              : rejectionRate <= 0.01
                ? "positive"
                : rejectionRate <= 0.05
                  ? "attention"
                  : "critical"
          }
        />
      </MetricRow>

      {/* ── Clip inspector ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Clip inspector"
          hint="Audition a detection and inspect its time-frequency signature. Where the pipeline rendered a spectrogram, that image is shown; otherwise one is computed live from the audio."
        />
        <AudioReviewPanel clips={clips} />
      </Card>

      {/* ── Confidence distribution ───────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Model confidence distribution"
          hint="Ten equal buckets over [0, 1]. Shape matters more than the mean: a bimodal distribution means the model is decisive, a central hump means it is guessing."
        />
        <ConfidenceHistogram bins={histogram} />
      </Card>

      {/* ── Throughput ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Ingestion throughput"
          hint="Hourly ingest attempts across the estate. Flat stretches with no bar mean no balise reported that hour."
        />
        <ThroughputChart buckets={throughput} since={since} />
      </Card>

      {/* ── Inference queue ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Inference queue"
          hint="Clips are stored and enqueued at ingest, then classified out-of-band so model latency never back-pressures a field radio."
        />
        <Table
          head={["Enqueued", "Status", "Codec", "Duration", "Priority", "Attempts", "Worker", "Error"]}
          empty="Queue is empty — every ingested clip in this window has been classified."
        >
          {queue.map((job) => (
            <Row key={job.id}>
              <Cell align="right">{formatDateTime(job.enqueued_at)}</Cell>
              <Cell>
                <Status tone={jobTone(job.status)} label={job.status} />
              </Cell>
              <Cell mono>{job.audio_codec}</Cell>
              <Cell align="right">{formatDuration(job.duration_ms)}</Cell>
              <Cell align="right">{job.priority}</Cell>
              <Cell align="right">{job.attempts}</Cell>
              <Cell mono>{job.locked_by ?? "—"}</Cell>
              <Cell className="max-w-[20rem] truncate whitespace-normal">
                {job.last_error ?? "—"}
              </Cell>
            </Row>
          ))}
        </Table>
      </Card>

      {/* ── Ingest failures ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Rejected ingests"
          hint="A unit that starts failing auth after a firmware flash simply stops appearing in the data. This log is what makes that failure visible."
        />
        <Table
          head={["Received", "Hardware ID", "Outcome", "HTTP", "Error", "Payload", "Detail"]}
          empty="No rejected ingests in this window."
        >
          {ingestFailures.map((entry) => (
            <Row key={entry.id}>
              <Cell align="right">{formatDateTime(entry.received_at)}</Cell>
              <Cell mono>{entry.hardware_id ?? "—"}</Cell>
              <Cell>
                <Status tone="critical" label={entry.outcome} />
              </Cell>
              <Cell align="right">{entry.http_status}</Cell>
              <Cell mono>{entry.error_code ?? "—"}</Cell>
              <Cell align="right">{formatBytes(entry.payload_bytes)}</Cell>
              <Cell className="max-w-[22rem] truncate whitespace-normal">
                {entry.error_detail ?? "—"}
              </Cell>
            </Row>
          ))}
        </Table>
      </Card>

      <p className={TYPE.meta}>
        Window opens {formatDateTime(since.toISOString())}. Signed clip URLs
        expire 30 minutes after this page was rendered; reload to refresh them.
      </p>
    </Page>
  );
}
