"use client";

import { useEffect, useMemo, useState } from "react";
import { DigitalTwin, type TwinSensor } from "@/components/twin/DigitalTwin";
import type { GeoPoint } from "@/lib/geo";
import type { LobbyCameraMode, SoundscapeMode } from "@/types/database";

/**
 * Permanent hall display.
 *
 * Runs unattended for months on a wall-mounted screen, which shapes every
 * decision here:
 *   • No interactive controls and no cursor — nothing for a passer-by to break.
 *   • Detections are polled, so the display self-heals after a network drop
 *     without any reconnect logic to get wrong.
 *   • A slow clock and gentle crossfades: this sits in a lounge, not a NOC.
 *   • The whole surface is legible from across a room, so type is large and
 *     contrast is high.
 */

export interface LobbyDetection {
  id: string;
  speciesName: string;
  latinName: string | null;
  detectedAt: string;
}

export interface LobbyKioskProps {
  resortName: string;
  slug: string;
  assetUrl: string | null;
  origin: GeoPoint;
  headingDeg: number;
  spanMeters: number;
  sensors: TwinSensor[];
  initialDetections: LobbyDetection[];
  featuredSpecies: {
    commonName: string;
    latinName: string;
    description: string | null;
    imageUrl: string | null;
  } | null;
  cameraMode: LobbyCameraMode;
  orbitPeriodSeconds: number;
  soundscapeMode: SoundscapeMode;
  showLiveAlerts: boolean;
  showSpeciesNames: boolean;
  locale: "fr" | "en";
}

const POLL_INTERVAL_MS = 60_000;

/** How long a newly detected species is highlighted as an alert. */
const ALERT_VISIBLE_MS = 30_000;

const COPY = {
  fr: {
    eyebrow: "Inventaire vivant",
    listening: "à l'écoute",
    recentlyHeard: "Détections récentes",
    justHeard: "Vient d'être entendu",
    featured: "Espèce à l'honneur",
    stations: "stations",
    quiet: "Le domaine écoute. Les détections apparaîtront ici.",
  },
  en: {
    eyebrow: "Living inventory",
    listening: "listening",
    recentlyHeard: "Recent detections",
    justHeard: "Just heard",
    featured: "Featured species",
    stations: "stations",
    quiet: "The estate is listening. Detections will appear here.",
  },
} as const;

export function LobbyKiosk({
  resortName,
  slug,
  assetUrl,
  origin,
  headingDeg,
  spanMeters,
  sensors,
  initialDetections,
  featuredSpecies,
  cameraMode,
  orbitPeriodSeconds,
  soundscapeMode,
  showLiveAlerts,
  showSpeciesNames,
  locale,
}: LobbyKioskProps) {
  const t = COPY[locale];

  const [detections, setDetections] = useState(initialDetections);
  const [alert, setAlert] = useState<LobbyDetection | null>(null);
  const [clock, setClock] = useState<string>("");

  // Clock is client-only: rendering server time would show a stale minute
  // until hydration, and this is the one element a viewer checks against
  // reality.
  useEffect(() => {
    function tick() {
      setClock(
        new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date())
      );
    }
    tick();
    const timer = window.setInterval(tick, 15_000);
    return () => window.clearInterval(timer);
  }, [locale]);

  // Poll for new detections and surface genuinely new ones as an alert.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/lobby/detections", {
          cache: "no-store",
        });
        if (!response.ok) return;

        const payload = (await response.json()) as {
          ok: boolean;
          data?: { detections: LobbyDetection[] };
        };

        if (cancelled || !payload.ok || !payload.data) return;

        const incoming = payload.data.detections;

        setDetections((previous) => {
          const knownIds = new Set(previous.map((entry) => entry.id));
          const fresh = incoming.find((entry) => !knownIds.has(entry.id));

          // Only announce on a subsequent poll: on the very first poll every
          // id is "new" relative to an empty set, which would fire a spurious
          // alert every time the display reloads.
          if (fresh && previous.length > 0 && showLiveAlerts) {
            setAlert(fresh);
            window.setTimeout(() => setAlert(null), ALERT_VISIBLE_MS);
          }

          return incoming;
        });
      } catch {
        // A failed poll is expected on a flaky lounge network. The next tick
        // recovers; showing an error on a guest-facing screen would not help.
      }
    }

    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [showLiveAlerts]);

  const activeSensors = useMemo(
    () => sensors.filter((sensor) => sensor.status === "active").length,
    [sensors]
  );

  return (
    <main className="kiosk-root relative h-[100svh] w-full overflow-hidden bg-canopy-950">
      <DigitalTwin
        assetUrl={assetUrl}
        georeference={{ origin, headingDeg, spanMeters }}
        sensors={sensors}
        seed={slug}
        ambient
        orbitPeriodSeconds={cameraMode === "static" ? 100_000 : orbitPeriodSeconds}
        className="absolute inset-0"
      />

      {/* Vignette: keeps text legible over a bright patch of terrain. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(5,13,10,0.72) 0%, transparent 28%, transparent 62%, rgba(5,13,10,0.85) 100%)",
        }}
      />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-6 p-8">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.22em] text-sand-200/60">
            {t.eyebrow}
          </p>
          <h1 className="mt-2 font-sans text-[2.6rem] font-light leading-[1.05] tracking-[-0.03em] text-sand-100">
            {resortName}
          </h1>
        </div>

        <div className="text-right">
          <p className="font-sans text-[2.1rem] font-light leading-none tabular-nums text-sand-100">
            {clock}
          </p>
          <p className="mt-2 text-[13px] tracking-[0.06em] text-sand-200/60">
            {activeSensors} / {sensors.length} {t.stations} {t.listening}
          </p>
          {soundscapeMode !== "muted" ? (
            <p className="mt-1 text-[12px] uppercase tracking-[0.16em] text-moss-300/70">
              {soundscapeMode === "live_detections"
                ? "live soundscape"
                : "ambient soundscape"}
            </p>
          ) : null}
        </div>
      </header>

      {/* ── Live alert ───────────────────────────────────────────────────── */}
      {alert && showLiveAlerts ? (
        <div className="absolute left-1/2 top-32 z-20 -translate-x-1/2 animate-slide-up">
          <div
            className="hud-panel px-7 py-4 text-center"
            style={{ borderColor: "var(--hud-accent-line)" }}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gold-400">
              {t.justHeard}
            </p>
            <p className="mt-2 font-sans text-[1.7rem] font-light leading-tight tracking-[-0.02em] text-sand-100">
              {alert.speciesName}
            </p>
            {alert.latinName ? (
              <p className="mt-0.5 text-[14px] italic text-sand-200/60">
                {alert.latinName}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ── Featured species ─────────────────────────────────────────────── */}
      {featuredSpecies ? (
        <aside className="absolute bottom-8 right-8 z-10 w-[26rem]">
          <div className="hud-panel overflow-hidden">
            {featuredSpecies.imageUrl ? (
              <img
                src={featuredSpecies.imageUrl}
                alt={featuredSpecies.commonName}
                className="h-44 w-full animate-ken-burns object-cover"
              />
            ) : null}
            <div className="px-6 py-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand-200/55">
                {t.featured}
              </p>
              <p className="mt-2 font-sans text-[1.4rem] font-light leading-tight tracking-[-0.02em] text-sand-100">
                {featuredSpecies.commonName}
              </p>
              <p className="mt-0.5 text-[13px] italic text-sand-200/60">
                {featuredSpecies.latinName}
              </p>
              {featuredSpecies.description ? (
                <p className="mt-3 line-clamp-4 text-[14px] leading-[1.55] text-sand-200/80">
                  {featuredSpecies.description}
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      ) : null}

      {/* ── Detection ticker ─────────────────────────────────────────────── */}
      <section className="absolute bottom-8 left-8 z-10 max-w-[34rem]">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sand-200/55">
          {t.recentlyHeard}
        </p>

        {detections.length === 0 ? (
          <p className="mt-3 text-[15px] text-sand-200/70">{t.quiet}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {detections.slice(0, 5).map((detection, index) => (
              <li
                key={detection.id}
                className="flex items-baseline gap-3"
                // Older entries recede, so the eye lands on the newest first.
                style={{ opacity: 1 - index * 0.16 }}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-moss-400"
                  aria-hidden
                />
                <span className="font-sans text-[1.15rem] font-light tracking-[-0.015em] text-sand-100">
                  {showSpeciesNames ? detection.speciesName : "—"}
                </span>
                {showSpeciesNames && detection.latinName ? (
                  <span className="text-[13px] italic text-sand-200/50">
                    {detection.latinName}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
