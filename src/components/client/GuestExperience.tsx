"use client";

import { useMemo, useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import { DigitalTwin, type TwinSensor } from "@/components/twin/DigitalTwin";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLocale } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/types";
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
  speciesNameEn: string;
  speciesNameFr: string;
  latinName: string | null;
  detectedAt: string;
  sensorName: string;
  audioUrl: string | null;
  spectrogramUrl: string | null;
  descriptionEn: string | null;
  descriptionFr: string | null;
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

const IUCN_TONE: Record<string, string> = {
  vulnerable: "#f59e0b",
  endangered: "#f0a58a",
  critically_endangered: "#f87171",
};

function pickName(en: string, fr: string, locale: Locale): string {
  return locale === "fr" ? fr || en : en || fr;
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
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
  const { locale, messages } = useLocale();
  const t = messages.guest;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selected = detections.find((d) => d.detectionId === selectedId) ?? null;

  const activeSensorId = useMemo(() => {
    if (!selected) return null;
    return sensors.find((sensor) => sensor.name === selected.sensorName)?.id ?? null;
  }, [selected, sensors]);

  function relativeLabel(iso: string, now: number): string {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return "";

    const minutes = Math.max(0, Math.round((now - then) / 60_000));
    if (minutes < 2) return t.justNow;
    if (minutes < 60) return fill(t.minutesAgo, { n: minutes });

    const hours = Math.round(minutes / 60);
    if (hours === 1) return t.anHourAgo;
    if (hours < 24) return fill(t.hoursAgo, { n: hours });

    const days = Math.round(hours / 24);
    return days === 1 ? t.yesterday : fill(t.daysAgo, { n: days });
  }

  function togglePlay(detection: GuestDetection) {
    if (!detection.audioUrl) return;

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

  const selectedName = selected
    ? pickName(selected.speciesNameEn, selected.speciesNameFr, locale)
    : "";
  const selectedDescription = selected
    ? locale === "fr"
      ? selected.descriptionFr || selected.descriptionEn
      : selected.descriptionEn || selected.descriptionFr
    : null;

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

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <div className="hud-surface pointer-events-auto px-3 py-2">
          <p className="hud-eyebrow">{t.eyebrow}</p>
          <p className="mt-1 hud-title">{resortName}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="hud-surface pointer-events-auto px-3 py-2">
            <LanguageSwitcher variant="hud" />
          </div>
          <div className="hud-surface pointer-events-auto px-3 py-2 text-right">
            <p className="hud-eyebrow">{t.listening}</p>
            <p className="mt-1 hud-title">
              {sensors.filter((sensor) => sensor.status === "active").length}{" "}
              {t.of} {sensors.length} {t.stations}
            </p>
          </div>
        </div>
      </header>

      <section className="absolute inset-x-0 bottom-0 z-10 p-4">
        <p className="hud-eyebrow mb-2 px-1">{t.recentlyHeard}</p>

        {detections.length === 0 ? (
          <div className="hud-panel px-4 py-3">
            <p className="hud-body">{t.quiet}</p>
          </div>
        ) : (
          <ul className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1">
            {detections.map((detection) => {
              const active = detection.detectionId === selectedId;
              const isPlaying = detection.detectionId === playingId;
              const name = pickName(
                detection.speciesNameEn,
                detection.speciesNameFr,
                locale
              );

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
                      <p className="hud-title truncate">{name}</p>
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
                        {isPlaying ? t.stop : t.listen}
                      </button>

                      {!detection.audioUrl ? (
                        <span className="hud-meta">{t.recordingUnavailable}</span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selected ? (
        <aside className="absolute right-4 top-20 z-20 max-h-[calc(100svh-13rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto">
          <div className="hud-panel">
            <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
              <div className="min-w-0">
                <p className="font-sans text-[15px] font-medium leading-tight tracking-[-0.02em] text-sand-100">
                  {selectedName}
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
                aria-label={t.close}
                className="shrink-0 rounded-md border p-1 text-sand-200/70 transition-colors hover:text-sand-100"
                style={{ borderColor: "var(--hud-line)" }}
              >
                <X size={13} aria-hidden />
              </button>
            </div>

            {selected.imageUrl ? (
              <img
                src={selected.imageUrl}
                alt={selectedName}
                className="mt-3 h-40 w-full object-cover"
              />
            ) : null}

            {selected.spectrogramUrl ? (
              <div className="mt-3 px-4">
                <p className="hud-eyebrow">{t.soundSignature}</p>
                <img
                  src={selected.spectrogramUrl}
                  alt={fill(t.spectrogramAlt, { species: selectedName })}
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
                  {t.iucn[selected.iucnStatus] ?? selected.iucnStatus}
                </p>
              ) : null}

              {selectedDescription ? (
                <p className="mt-2 text-[13px] leading-[1.6] text-sand-200/85">
                  {selectedDescription}
                </p>
              ) : (
                <p className="mt-2 hud-body">{t.noProfile}</p>
              )}

              <dl className="mt-3 border-t pt-3" style={{ borderColor: "var(--hud-line)" }}>
                {[
                  [t.size, selected.sizeLabel],
                  [t.weight, selected.weightLabel],
                  [t.lifespan, selected.maxAgeLabel],
                  [t.heardBy, selected.sensorName],
                  [t.detected, relativeLabel(selected.detectedAt, renderedAt)],
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
