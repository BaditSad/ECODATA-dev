import { TONE, TYPE } from "@/components/console/ui";
import { formatBytes, formatNumber } from "@/lib/format";
import type { IngestThroughputBucket } from "@/types/database";
import { messages } from "@/i18n/server";
import { fill } from "@/i18n/console";

/**
 * Hourly ingest throughput.
 *
 * Stacked bars: accepted below, rejected above, so the total height is total
 * attempts and any red is immediately legible as fleet trouble. Gaps in the
 * series are filled with zero-height hours rather than skipped, because a
 * missing hour is exactly the signal an operator needs to see.
 */
export function ThroughputChart({
  buckets,
  since,
}: {
  buckets: IngestThroughputBucket[];
  since: Date;
}) {
  const t = messages();
  if (buckets.length === 0) {
    return (
      <p className="px-4 py-10 text-center font-sans text-[12px] text-[var(--edl-muted)]">
        {t.audio.throughputEmpty}
      </p>
    );
  }

  const byHour = new Map(
    buckets.map((bucket) => [
      new Date(bucket.hour).toISOString().slice(0, 13),
      bucket,
    ])
  );

  // Rebuild a dense hourly series so absent hours render as gaps.
  const start = new Date(since);
  start.setUTCMinutes(0, 0, 0);
  const hourCount = Math.max(
    1,
    Math.min(
      168,
      Math.ceil((Date.now() - start.getTime()) / 3_600_000)
    )
  );

  const series = Array.from({ length: hourCount }, (_, index) => {
    const hour = new Date(start.getTime() + index * 3_600_000);
    const key = hour.toISOString().slice(0, 13);
    const bucket = byHour.get(key);
    return {
      hour,
      accepted: bucket?.accepted ?? 0,
      rejected: bucket?.rejected ?? 0,
      bytes: bucket?.audio_bytes ?? 0,
    };
  });

  const peak = Math.max(
    ...series.map((point) => point.accepted + point.rejected),
    1
  );

  const totals = series.reduce(
    (acc, point) => {
      acc.accepted += point.accepted;
      acc.rejected += point.rejected;
      acc.bytes += point.bytes;
      return acc;
    },
    { accepted: 0, rejected: 0, bytes: 0 }
  );

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-end gap-[2px]" style={{ height: "7rem" }}>
        {series.map((point) => {
          const total = point.accepted + point.rejected;
          const totalPct = (total / peak) * 100;
          const rejectedShare = total === 0 ? 0 : point.rejected / total;

          return (
            <div
              key={point.hour.toISOString()}
              className="flex min-w-0 flex-1 flex-col justify-end"
              style={{ height: "100%" }}
              title={fill(t.audio.throughputBar, {
                when: point.hour.toISOString().slice(0, 16).replace("T", " "),
                accepted: point.accepted,
                rejected: point.rejected,
                bytes: formatBytes(point.bytes),
              })}
            >
              {total > 0 ? (
                <div
                  className="w-full overflow-hidden rounded-t-[2px]"
                  style={{ height: `${Math.max(2, totalPct)}%` }}
                >
                  {rejectedShare > 0 ? (
                    <div
                      style={{
                        height: `${rejectedShare * 100}%`,
                        background: TONE.critical.fg,
                      }}
                    />
                  ) : null}
                  <div
                    style={{
                      height: `${(1 - rejectedShare) * 100}%`,
                      background: TONE.positive.fg,
                      opacity: 0.85,
                    }}
                  />
                </div>
              ) : (
                // Zero-height hour: a hairline marks that the hour existed and
                // was silent, distinct from an hour trimmed off the chart.
                <div
                  className="w-full"
                  style={{ height: "1px", background: "var(--edl-border-strong)" }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex justify-between">
        <span className={TYPE.meta}>
          {series[0]?.hour.toISOString().slice(5, 16).replace("T", " ")} UTC
        </span>
        <span className={TYPE.meta}>{t.audio.throughputNow}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-[var(--edl-border)] pt-3">
        <span className={TYPE.meta}>
          <span style={{ color: TONE.positive.fg }}>■</span> {formatNumber(totals.accepted)}{" "}
          {t.audio.throughputAccepted}
        </span>
        <span className={TYPE.meta}>
          <span style={{ color: TONE.critical.fg }}>■</span> {formatNumber(totals.rejected)}{" "}
          {t.audio.throughputRejected}
        </span>
        <span className={TYPE.meta}>
          {fill(t.audio.throughputBytes, { bytes: formatBytes(totals.bytes) })}
        </span>
        <span className={TYPE.meta}>
          {fill(t.audio.throughputPeak, { n: formatNumber(peak) })}
        </span>
      </div>
    </div>
  );
}
