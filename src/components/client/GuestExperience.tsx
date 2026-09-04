"use client";

import { useMemo, useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import { DigitalTwin, type TwinSensor } from "@/components/twin/DigitalTwin";
import type { GeoPoint } from "@/lib/geo";

/**
 * Guest experience.
 *
 * One screen, two layers: the twin fills the viewport and thin glass panels
 * float over it. Deliberately not a dashboard — a guest is not auditing a
 * sensor fleet, they want to know what is out there and hear it.
 *
 * Confidence is never shown as a percentage. "94% Ramphastos sulfuratus" is a
 * machine-learning artefact, not a fact about a bird; the staff console is
 * where those numbers belong.
 */

export interface GuestDetection {
  detectionId: string;
  speciesName: string;
  latinName: string | null;
  detectedAt: string;
  sensorName: string;
  audioUrl: string | null;
  spectrogramUrl: string | null;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  iucnStatus: string | null;
  sizeLabel: string | null;
  weightLabel: string | null;
  maxAgeLabel: string | null;
}

export interface GuestExperienceProps {
  resortName: string;
  slug: string;
  assetUrl: string | null;
  origin: GeoPoint;
  headingDeg: number;
  spanMeters: number;
  sensors: TwinSensor[];
  detections: GuestDetection[];
  /** Server render time, so relative labels agree on first paint. */
  renderedAt: number;
}

const IUCN_LABEL: Record<string, string> = {
  not_evaluated: "Not evaluated",
  data_deficient: "Data deficient",
  least_concern: "Least concern",
  near_threatened: "Near threatened",
  vulnerable: "Vulnerable",
  endangered: "Endangered",
  critically_endangered: "Critically endangered",
  extinct_in_the_wild: "Extinct in the wild",
  extinct: "Extinct",
};

/** Only the statuses that warrant visual emphasis get colour. */
const IUCN_TONE: Record<string, string> = {
  vulnerable: "#f59e0b",
  endangered: "#f0a58a",
  critically_endangered: "#f87171",
};

function relativeLabel(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";

  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 2) return "moments ago";
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;

  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function GuestExperience({
  resortName,
  slug,
  assetUrl,
  origin,
  headingDeg,
  spanMeters,
  sensors,
  detections,
  renderedAt,
}: GuestExperienceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selected = detections.find((d) => d.detectionId === selectedId) ?? null;

  // Which balise heard the selected call, so the twin can highlight it.
  const activeSensorId = useMemo(() => {
    if (!selected) return null;
    return sensors.find((sensor) => sensor.name === selected.sensorName)?.id ?? null;
  }, [selected, sensors]);

  function togglePlay(detection: GuestDetection) {
    if (!detection.audioUrl) return;

    // One clip at a time: overlapping birdsong is noise, not an experience.
    if (playingId === detection.detectionId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    audioRef.current?.pause();

    const audio = new Audio(detection.audioUrl);
    audio.addEventListener("ended", () => setPlayingId(null));
    audio.addEventListener("error", () => setPlayingId(null));
    audioRef.current = audio;

    void audio.play().then(
      () => setPlayingId(detection.detectionId),
      () => setPlayingId(null)
    );
  }

  return (
    <main className="relative h-[100svh] w-full overflow-hidden bg-canopy-950">
      <DigitalTwin
        assetUrl={assetUrl}
        georeference={{ origin, headingDeg, spanMeters }}
        sensors={sensors}
        seed={slug}
        activeSensorId={activeSensorId}
        onSelectSensor={(sensorId) => {
          const sensor = sensors.find((entry) => entry.id === sensorId);
          if (!sensor) return;
          const match = detections.find((d) => d.sensorName === sensor.name);
          if (match) setSelectedId(match.detectionId);
        }}
        className="absolute inset-0"
      />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <div className="hud-surface pointer-events-auto px-3 py-2">
          <p className="hud-eyebrow">Living inventory</p>
          <p className="mt-1 hud-title">{resortName}</p>
        </div>

        <div className="hud-surface pointer-events-auto px-3 py-2 text-right">
          <p className="hud-eyebrow">Listening</p>
          <p className="mt-1 hud-title">
            {sensors.filter((sensor) => sensor.status === "active").length} of{" "}
            {sensors.length} stations
          </p>
        </div>
      </header>

      {/* ── Detection rail ───────────────────────────────────────────────── */}
      <section className="absolute inset-x-0 bottom-0 z-10 p-4">
        <p className="hud-eyebrow mb-2 px-1">Recently heard</p>

        {detections.length === 0 ? (
          <div className="hud-panel px-4 py-3">
            <p className="hud-body">
              The estate is listening. Detections will appear here as wildlife is
              identified — dawn and dusk are the most active hours.
            </p>
          </div>
        ) : (
          <ul className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1">
            {detections.map((detection) => {
              const active = detection.detectionId === selectedId;
              const isPlaying = detection.detectionId === playingId;

              return (
                <li
                  key={detection.detectionId}
                  className="w-[15rem] shrink-0 snap-start"
                >
                  <div
                    className="hud-panel h-full px-3 py-2.5"
                    style={
                      active
                        ? { borderColor: "var(--hud-accent-line)" }
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(detection.detectionId)}
                      className="block w-full text-left"
                    >
                      <p className="hud-title truncate">{detection.speciesName}</p>
                      {detection.latinName ? (
                        <p className="mt-0.5 truncate text-[11px] italic text-sand-200/55">
                          {detection.latinName}
                        </p>
                      ) : null}
                      <p className="mt-1.5 hud-meta">
                        {detection.sensorName} ·{" "}
                        {relativeLabel(detection.detectedAt, renderedAt)}
                      </p>
                    </button>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => togglePlay(detection)}
                        disabled={!detection.audioUrl}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-sand-100 transition-colors disabled:opacity-35"
                        style={{
                          borderColor: "var(--hud-accent-line)",
                          background: "var(--hud-accent-soft)",
                        }}
                      >
                        {isPlaying ? (
                          <Pause size={11} aria-hidden />
                        ) : (
                          <Play size={11} aria-hidden />
                        )}
                        {isPlaying ? "Stop" : "Listen"}
                      </button>

                      {!detection.audioUrl ? (
                        <span className="hud-meta">Recording unavailable</span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Species detail ───────────────────────────────────────────────── */}
      {selected ? (
        <aside className="absolute right-4 top-20 z-20 max-h-[calc(100svh-13rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto">
          <div className="hud-panel">
            <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
              <div className="min-w-0">
                <p className="font-sans text-[15px] font-medium leading-tight tracking-[-0.02em] text-sand-100">
                  {selected.speciesName}
                </p>
                {selected.latinName ? (
                  <p className="mt-0.5 text-[12px] italic text-sand-200/60">
                    {selected.latinName}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close"
                className="shrink-0 rounded-md border p-1 text-sand-200/70 transition-colors hover:text-sand-100"
                style={{ borderColor: "var(--hud-line)" }}
              >
                <X size={13} aria-hidden />
              </button>
            </div>

            {selected.imageUrl ? (
              <img
                src={selected.imageUrl}
                alt={selected.speciesName}
                className="mt-3 h-40 w-full object-cover"
              />
            ) : null}

            {selected.spectrogramUrl ? (
              <div className="mt-3 px-4">
                <p className="hud-eyebrow">Sound signature</p>
                <img
                  src={selected.spectrogramUrl}
                  alt={`Spectrogram of the ${selected.speciesName} call`}
                  className="mt-1.5 h-20 w-full rounded object-cover"
                />
              </div>
            ) : null}

            <div className="px-4 py-3.5">
              {selected.iucnStatus ? (
                <p
                  className="text-[10px] font-medium uppercase tracking-[0.12em]"
                  style={{
                    color: IUCN_TONE[selected.iucnStatus] ?? "rgba(232,223,208,0.6)",
                  }}
                >
                  {IUCN_LABEL[selected.iucnStatus] ?? selected.iucnStatus}
                </p>
              ) : null}

              {selected.description ? (
                <p className="mt-2 text-[13px] leading-[1.6] text-sand-200/85">
                  {selected.description}
                </p>
              ) : (
                <p className="mt-2 hud-body">
                  A detailed profile for this species has not been added to the
                  catalogue yet.
                </p>
              )}

              <dl className="mt-3 border-t pt-3" style={{ borderColor: "var(--hud-line)" }}>
                {[
                  ["Size", selected.sizeLabel],
                  ["Weight", selected.weightLabel],
                  ["Lifespan", selected.maxAgeLabel],
                  ["Heard by", selected.sensorName],
                  ["Detected", relativeLabel(selected.detectedAt, renderedAt)],
                ]
                  .filter(([, value]) => Boolean(value))
                  .map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-baseline justify-between gap-3 py-1"
                    >
                      <dt className="hud-meta">{label}</dt>
                      <dd className="text-[12px] text-sand-100">{value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </div>
        </aside>
      ) : null}
    </main>
  );
}
