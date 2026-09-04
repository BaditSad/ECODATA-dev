"use client";

import { useState } from "react";
import { TYPE } from "@/components/console/ui";
import {
  SpectrogramPlayer,
  type SpectrogramClip,
} from "@/components/admin/audio/SpectrogramPlayer";
import { confidenceTone, formatPercent, formatRelative } from "@/lib/format";
import { TONE } from "@/components/console/ui";

/**
 * Detection stream paired with the clip inspector.
 *
 * Selection lives here so the player keeps its Web Audio graph across clip
 * changes — remounting it per selection would tear down and rebuild the
 * `AudioContext` on every click, which browsers rate-limit.
 */
export function AudioReviewPanel({ clips }: { clips: SpectrogramClip[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    clips[0]?.id ?? null
  );
  const [now] = useState(() => Date.now());

  const selected = clips.find((clip) => clip.id === selectedId) ?? null;

  return (
    <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="border-b border-[var(--bt-border)] lg:border-b-0 lg:border-r">
        <SpectrogramPlayer clip={selected} />
      </div>

      <div className="max-h-[30rem] overflow-y-auto">
        {clips.length === 0 ? (
          <p className="px-4 py-10 text-center font-sans text-[12px] text-[var(--bt-muted)]">
            No detections in this window.
          </p>
        ) : (
          <ul>
            {clips.map((clip) => {
              const active = clip.id === selectedId;
              const tone = confidenceTone(clip.confidence);

              return (
                <li key={clip.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(clip.id)}
                    aria-current={active}
                    className="w-full border-b border-[var(--bt-border)] px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-[var(--bt-soft)]"
                    style={
                      active ? { background: "var(--bt-emerald-10)" } : undefined
                    }
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate font-sans text-[12px] font-medium text-[var(--bt-text)]">
                        {clip.speciesName}
                      </span>
                      <span
                        className="shrink-0 font-sans text-[11px] font-medium tabular-nums"
                        style={{ color: TONE[tone].fg }}
                      >
                        {formatPercent(clip.confidence, 0)}
                      </span>
                    </span>

                    <span className={`mt-0.5 block truncate ${TYPE.meta}`}>
                      {clip.sensorName ?? "Unknown unit"}
                      {clip.tenantName ? ` · ${clip.tenantName}` : ""}
                    </span>

                    <span className={`mt-0.5 block ${TYPE.meta}`}>
                      {formatRelative(clip.detectedAt, now)}
                      {clip.spectrogramUrl ? " · spectrogram rendered" : ""}
                      {!clip.audioUrl ? " · clip missing" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
