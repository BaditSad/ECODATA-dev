import Link from "next/link";
import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/erp";
import { fetchAudioAnalytics } from "@/modules/audio/data";
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
import { ConfidenceHistogram } from "@/modules/audio/components/ConfidenceHistogram";
import { ThroughputChart } from "@/modules/audio/components/ThroughputChart";
import { AudioReviewPanel } from "@/modules/audio/components/AudioReviewPanel";
import type { SpectrogramClip } from "@/modules/audio/components/SpectrogramPlayer";
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { MlJobStatus } from "@/types/database";
import { currentLocale, messages } from "@/i18n/server";
import { fill } from "@/i18n/console";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messages().audio.title };
}

export const dynamic = "force-dynamic";

const WINDOW_HOURS = [6, 24, 72, 168] as const;

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
  await requireModule("audio");

  const requested = Number(searchParams.window);
  const windowHours = WINDOW_HOURS.includes(
    requested as (typeof WINDOW_HOURS)[number]
  )
    ? requested
    : DEFAULT_WINDOW_HOURS;

  const since = new Date(Date.now() - windowHours * 3_600_000);
  const copy = messages();
  const locale = currentLocale();
  const windowLabels: Record<number, string> = {
    6: copy.audio.window6h,
    24: copy.audio.window24h,
    72: copy.audio.window72h,
    168: copy.audio.window168h,
  };

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

  const windowLabel = windowLabels[windowHours] ?? copy.audio.window24h;

  return (
    <Page>
      <PageHeader
        title={copy.audio.title}
        purpose={fill(copy.audio.purpose, { window: windowLabel })}
      >
        <span className="inline-flex rounded-md border border-[var(--edl-border)] bg-[var(--edl-soft)] p-[3px]">
          {WINDOW_HOURS.map((hours) => {
            const active = hours === windowHours;
            return (
              <Link
                key={hours}
                href={`/admin/audio?window=${hours}`}
                className="rounded-[5px] px-2.5 py-1 font-sans text-[12px] transition-colors"
                style={
                  active
                    ? {
                        background: "var(--edl-card)",
                        color: "var(--edl-text)",
                        fontWeight: 500,
                      }
                    : { color: "var(--edl-muted)" }
                }
              >
                {windowLabels[hours]}
              </Link>
            );
          })}
        </span>
      </PageHeader>

      {/* ── Headline AI metrics ───────────────────────────────────────────── */}
      <MetricRow>
        <Metric
          label={copy.audio.detections}
          value={formatNumber(summary.detections_total)}
          hint={fill(copy.audio.species, {
            n: formatNumber(summary.distinct_species),
          })}
        />
        <Metric
          label={copy.audio.meanConfidence}
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
          label={copy.audio.autoPublish}
          value={formatPercent(summary.high_confidence_share, 1)}
          hint={copy.audio.autoPublishHint}
        />
        <Metric
          label={copy.audio.reviewPrecision}
          value={precision === null ? copy.empty : formatPercent(precision, 1)}
          hint={
            summary.detections_reviewed === 0
              ? copy.audio.reviewPrecisionEmpty
              : copy.audio.reviewPrecisionHint
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
          label={copy.audio.ingested}
          value={formatBytes(summary.ingest_bytes)}
          hint={fill(copy.audio.ingestedHint, {
            n: summary.audio_minutes.toFixed(1),
          })}
        />
      </MetricRow>

      {/* ── Pipeline health ───────────────────────────────────────────────── */}
      <MetricRow>
        <Metric
          label={copy.audio.queueDepth}
          value={formatNumber(summary.jobs_queued)}
          hint={copy.audio.queueHint}
          tone={
            summary.jobs_queued > 500
              ? "critical"
              : summary.jobs_queued > 100
                ? "attention"
                : "positive"
          }
        />
        <Metric
          label={copy.audio.inFlight}
          value={formatNumber(summary.jobs_processing)}
          hint={copy.audio.inFlightHint}
        />
        <Metric
          label={copy.audio.failedJobs}
          value={formatNumber(summary.jobs_failed)}
          hint={copy.audio.failedHint}
          tone={summary.jobs_failed > 0 ? "critical" : "positive"}
        />
        <Metric
          label={copy.audio.ingestOk}
          value={formatNumber(summary.ingest_accepted)}
          hint={fill(copy.audio.ingestOkHint, {
            n: formatNumber(summary.ingest_rejected),
          })}
        />
        <Metric
          label={copy.audio.rejectRate}
          value={rejectionRate === null ? copy.empty : formatPercent(rejectionRate, 1)}
          hint={copy.audio.rejectRateHint}
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
        <CardHeader title={copy.audio.inspector} hint={copy.audio.inspectorHint} />
        <AudioReviewPanel clips={clips} />
      </Card>

      {/* ── Confidence distribution ───────────────────────────────────────── */}
      <Card>
        <CardHeader title={copy.audio.histogram} hint={copy.audio.histogramHint} />
        <ConfidenceHistogram bins={histogram} />
      </Card>

      {/* ── Throughput ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title={copy.audio.throughput} hint={copy.audio.throughputHint} />
        <ThroughputChart buckets={throughput} since={since} />
      </Card>

      {/* ── Inference queue ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader title={copy.audio.queue} hint={copy.audio.queueCardHint} />
        <Table
          head={[
            copy.audio.colEnqueued,
            copy.audio.colStatus,
            copy.audio.colCodec,
            copy.audio.colDuration,
            copy.audio.colPriority,
            copy.audio.colAttempts,
            copy.audio.colWorker,
            copy.audio.colError,
          ]}
          empty={copy.audio.queueEmpty}
        >
          {queue.map((job) => (
            <Row key={job.id}>
              <Cell align="right">{formatDateTime(job.enqueued_at, locale)}</Cell>
              <Cell>
                <Status tone={jobTone(job.status)} label={copy.labels.mlJob[job.status] ?? job.status} />
              </Cell>
              <Cell mono>{job.audio_codec}</Cell>
              <Cell align="right">{formatDuration(job.duration_ms)}</Cell>
              <Cell align="right">{job.priority}</Cell>
              <Cell align="right">{job.attempts}</Cell>
              <Cell mono>{job.locked_by ?? copy.empty}</Cell>
              <Cell className="max-w-[20rem] truncate whitespace-normal">
                {job.last_error ?? copy.empty}
              </Cell>
            </Row>
          ))}
        </Table>
      </Card>

      {/* ── Ingest failures ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader title={copy.audio.rejected} hint={copy.audio.rejectedHint} />
        <Table
          head={[
            copy.audio.colReceived,
            copy.audio.colHardware,
            copy.audio.colOutcome,
            copy.audio.colHttp,
            copy.audio.colError,
            copy.audio.colPayload,
            copy.audio.colDetail,
          ]}
          empty={copy.audio.rejectedEmpty}
        >
          {ingestFailures.map((entry) => (
            <Row key={entry.id}>
              <Cell align="right">{formatDateTime(entry.received_at, locale)}</Cell>
              <Cell mono>{entry.hardware_id ?? copy.empty}</Cell>
              <Cell>
                <Status
                  tone="critical"
                  label={copy.labels.ingestOutcome[entry.outcome] ?? entry.outcome}
                />
              </Cell>
              <Cell align="right">{entry.http_status}</Cell>
              <Cell mono>{entry.error_code ?? copy.empty}</Cell>
              <Cell align="right">{formatBytes(entry.payload_bytes)}</Cell>
              <Cell className="max-w-[22rem] truncate whitespace-normal">
                {entry.error_detail ?? copy.empty}
              </Cell>
            </Row>
          ))}
        </Table>
      </Card>

      <p className={TYPE.meta}>
        {fill(copy.audio.windowNote, { since: formatDateTime(since.toISOString(), locale) })}
      </p>
    </Page>
  );
}
