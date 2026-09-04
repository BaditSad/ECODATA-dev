import { TONE, TYPE } from "@/components/console/ui";
import { formatNumber, formatPercent } from "@/lib/format";
import type { AudioConfidenceHistogramBin } from "@/types/database";

/**
 * ML confidence distribution.
 *
 * Rendered server-side as plain divs rather than with a charting library: it is
 * ten bars, and shipping a chart runtime to draw them would cost more than the
 * whole page. Bars are keyed to the 0.85 auto-publish threshold, because the
 * operational question this chart answers is "how much of the model's output
 * clears the bar for showing a guest without review".
 */

const AUTO_PUBLISH_THRESHOLD = 0.85;
const GUEST_FLOOR = 0.7;

export function ConfidenceHistogram({
  bins,
}: {
  bins: AudioConfidenceHistogramBin[];
}) {
  const total = bins.reduce((sum, bin) => sum + bin.detections, 0);

  if (total === 0) {
    return (
      <p className="px-4 py-10 text-center font-sans text-[12px] text-[var(--bt-muted)]">
        No detections in this window, so there is no distribution to plot.
      </p>
    );
  }

  const peak = Math.max(...bins.map((bin) => bin.detections), 1);

  const aboveThreshold = bins
    .filter((bin) => bin.lower_bound >= AUTO_PUBLISH_THRESHOLD)
    .reduce((sum, bin) => sum + bin.detections, 0);

  const belowGuestFloor = bins
    .filter((bin) => bin.upper_bound <= GUEST_FLOOR)
    .reduce((sum, bin) => sum + bin.detections, 0);

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-end gap-1.5" style={{ height: "10rem" }}>
        {bins.map((bin) => {
          const heightPct = (bin.detections / peak) * 100;

          // Colour encodes what the platform does with a call at this
          // confidence, not just its magnitude.
          const tone =
            bin.lower_bound >= AUTO_PUBLISH_THRESHOLD
              ? "positive"
              : bin.upper_bound <= GUEST_FLOOR
                ? "critical"
                : "attention";

          const label = `${bin.lower_bound.toFixed(1)}–${bin.upper_bound.toFixed(1)}`;

          return (
            <div
              key={bin.bucket_index}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              style={{ height: "100%" }}
            >
              <span className="font-sans text-[10px] tabular-nums text-[var(--bt-muted)]">
                {bin.detections > 0 ? formatNumber(bin.detections) : ""}
              </span>
              <div
                className="w-full rounded-t-[3px]"
                style={{
                  // Floor the height so a non-empty bucket is never invisible.
                  height: `${bin.detections > 0 ? Math.max(2, heightPct) : 0}%`,
                  background: TONE[tone].fg,
                  opacity: 0.85,
                }}
                title={`${label}: ${bin.detections} detections (${bin.confirmed} confirmed, ${bin.rejected} rejected)`}
                role="img"
                aria-label={`Confidence ${label}: ${bin.detections} detections`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-1.5">
        {bins.map((bin) => (
          <span
            key={bin.bucket_index}
            className="min-w-0 flex-1 text-center font-sans text-[9.5px] tabular-nums text-[var(--bt-muted)]"
          >
            {bin.upper_bound.toFixed(1)}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-[var(--bt-border)] pt-3">
        <span className={TYPE.meta}>
          <span style={{ color: TONE.positive.fg }}>■</span> ≥ 0.85 auto-publish ·{" "}
          {formatPercent(aboveThreshold / total, 1)} of calls
        </span>
        <span className={TYPE.meta}>
          <span style={{ color: TONE.attention.fg }}>■</span> 0.70–0.85 review queue
        </span>
        <span className={TYPE.meta}>
          <span style={{ color: TONE.critical.fg }}>■</span> &lt; 0.70 suppressed ·{" "}
          {formatPercent(belowGuestFloor / total, 1)} of calls
        </span>
      </div>
    </div>
  );
}
