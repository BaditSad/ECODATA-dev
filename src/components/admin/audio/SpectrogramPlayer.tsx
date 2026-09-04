"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, AudioWaveform } from "lucide-react";
import { TYPE } from "@/components/console/ui";

/**
 * Bioacoustic clip player with a live spectrogram.
 *
 * ── How the spectrogram is produced ─────────────────────────────────────────
 * When the pipeline has already rendered a spectrogram image, that image is
 * shown — it is the artefact the model actually saw, so it is the ground truth
 * for reviewing a call.
 *
 * Otherwise one is computed here in real time: an `AnalyserNode` tapped off the
 * `<audio>` element yields an FFT magnitude frame per animation tick, and each
 * frame is painted as a one-pixel column while the canvas scrolls left. That
 * gives a genuine time-frequency view rather than a decorative waveform, which
 * matters because distinguishing a howler monkey chorus from wind noise is a
 * judgement made on the spectrogram, not the amplitude envelope.
 *
 * Frequency axis is linear and capped at 12 kHz: nearly all target vocalisations
 * sit below it, and plotting to Nyquist would waste most of the canvas on
 * silence.
 */

/** Upper bound of the plotted frequency axis. */
const MAX_PLOT_HZ = 12_000;

/** 1024-point FFT at 48 kHz ≈ 21 ms windows — fine enough for birdsong onsets. */
const FFT_SIZE = 1024;

export interface SpectrogramClip {
  id: string;
  speciesName: string;
  latinName: string | null;
  confidence: number;
  detectedAt: string;
  sensorName: string | null;
  tenantName: string | null;
  audioUrl: string | null;
  spectrogramUrl: string | null;
  durationMs: number | null;
  freqLowHz: number | null;
  freqHighHz: number | null;
  modelVersion: string | null;
}

/**
 * Magma-like colour ramp.
 *
 * Perceptually ordered, so a brighter pixel always means more energy. A
 * rainbow ramp would create false banding where the hue changes fastest.
 */
function magma(intensity: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, intensity));
  const stops: [number, number, number, number][] = [
    [0.0, 8, 8, 20],
    [0.25, 60, 15, 90],
    [0.5, 140, 30, 105],
    [0.75, 226, 90, 70],
    [1.0, 252, 235, 160],
  ];

  for (let i = 0; i < stops.length - 1; i += 1) {
    const current = stops[i];
    const next = stops[i + 1];
    if (!current || !next) break;
    if (t >= current[0] && t <= next[0]) {
      const span = next[0] - current[0];
      const ratio = span === 0 ? 0 : (t - current[0]) / span;
      return [
        Math.round(current[1] + (next[1] - current[1]) * ratio),
        Math.round(current[2] + (next[2] - current[2]) * ratio),
        Math.round(current[3] + (next[3] - current[3]) * ratio),
      ];
    }
  }

  return [252, 235, 160];
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function SpectrogramPlayer({ clip }: { clip: SpectrogramClip | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Web Audio graph, built once on first playback and reused across clips.
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const frameRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [analysisAvailable, setAnalysisAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const usePrecomputed = Boolean(clip?.spectrogramUrl);

  /** Paint one FFT frame as a column, scrolling the canvas left by 1 px. */
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const context = contextRef.current;
    if (!canvas || !analyser || !context) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const bins = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(bins);

    // Shift the existing image one pixel left. Self-drawImage is the cheapest
    // scroll available on a 2D context and avoids a second backing canvas.
    ctx.drawImage(canvas, -1, 0);

    // Only the bins below MAX_PLOT_HZ are plotted.
    const nyquist = context.sampleRate / 2;
    const usableBins = Math.max(
      1,
      Math.floor((MAX_PLOT_HZ / nyquist) * analyser.frequencyBinCount)
    );

    for (let y = 0; y < height; y += 1) {
      // Canvas y grows downward; frequency should grow upward.
      const binIndex = Math.floor(((height - 1 - y) / height) * usableBins);
      const magnitude = (bins[binIndex] ?? 0) / 255;
      const [r, g, b] = magma(magnitude);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(width - 1, y, 1, 1);
    }

    frameRef.current = requestAnimationFrame(drawFrame);
  }, []);

  /**
   * Build the analyser graph.
   *
   * Deferred to a user gesture because browsers start an `AudioContext`
   * suspended. `createMediaElementSource` can only be called once per element,
   * hence the ref guard.
   */
  const ensureGraph = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;

    if (contextRef.current && sourceRef.current) {
      if (contextRef.current.state === "suspended") {
        await contextRef.current.resume();
      }
      return true;
    }

    try {
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextCtor) {
        setAnalysisAvailable(false);
        return false;
      }

      const context = new AudioContextCtor();
      const analyser = context.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      // Light smoothing: enough to suppress single-frame flicker without
      // blurring the transients that identify a call.
      analyser.smoothingTimeConstant = 0.4;

      const source = context.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(context.destination);

      contextRef.current = context;
      analyserRef.current = analyser;
      sourceRef.current = source;

      if (context.state === "suspended") await context.resume();
      return true;
    } catch {
      // Most often a CORS failure on the signed URL: playback still works via
      // the audio element, but the samples are opaque to the analyser.
      setAnalysisAvailable(false);
      return false;
    }
  }, []);

  // Reset transport and canvas whenever the selected clip changes.
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(clip?.durationMs ? clip.durationMs / 1000 : 0);
    setError(null);

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.fillStyle = "#08080f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [clip?.id, clip?.durationMs]);

  // Stop the render loop on unmount; a stray rAF would leak across navigations.
  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      void contextRef.current?.close();
      contextRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    };
  }, []);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !clip?.audioUrl) return;

    if (playing) {
      audio.pause();
      return;
    }

    if (!usePrecomputed) {
      const ready = await ensureGraph();
      if (ready && frameRef.current === null) {
        frameRef.current = requestAnimationFrame(drawFrame);
      }
    }

    try {
      await audio.play();
    } catch {
      setError("Playback was blocked by the browser.");
    }
  }

  function restart() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
  }

  if (!clip) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
        <AudioWaveform size={18} className="text-[var(--bt-muted)]" aria-hidden />
        <p className={TYPE.h2}>No clip selected</p>
        <p className="max-w-[42ch] font-sans text-[12px] leading-relaxed text-[var(--bt-muted)]">
          Choose a detection from the stream to audition its audio and inspect
          the time-frequency signature the model classified.
        </p>
      </div>
    );
  }

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div className="px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="font-sans text-[13px] font-semibold text-[var(--bt-text)]">
            {clip.speciesName}
          </p>
          {clip.latinName ? (
            <p className="font-sans text-[11px] italic text-[var(--bt-muted)]">
              {clip.latinName}
            </p>
          ) : null}
        </div>
        <p className={TYPE.meta}>
          {clip.sensorName ?? "Unknown unit"}
          {clip.tenantName ? ` · ${clip.tenantName}` : ""}
          {clip.modelVersion ? ` · ${clip.modelVersion}` : ""}
        </p>
      </div>

      {/* ── Spectrogram surface ──────────────────────────────────────────── */}
      <div
        className="relative mt-3 overflow-hidden rounded-md border"
        style={{ borderColor: "var(--bt-border-strong)", background: "#08080f" }}
      >
        {usePrecomputed && clip.spectrogramUrl ? (
          <img
            src={clip.spectrogramUrl}
            alt={`Spectrogram of the ${clip.speciesName} detection`}
            className="block h-[11rem] w-full object-cover"
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={900}
            height={176}
            className="block h-[11rem] w-full"
            aria-label="Live spectrogram of the playing clip"
            role="img"
          />
        )}

        {/* Frequency axis */}
        <div className="pointer-events-none absolute left-0 top-0 flex h-full flex-col justify-between px-1.5 py-1">
          {[MAX_PLOT_HZ, MAX_PLOT_HZ * 0.75, MAX_PLOT_HZ * 0.5, MAX_PLOT_HZ * 0.25, 0].map(
            (hz) => (
              <span
                key={hz}
                className="font-mono text-[9px] tabular-nums"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                {(hz / 1000).toFixed(hz === 0 ? 0 : 1)}k
              </span>
            )
          )}
        </div>

        {/* Detected frequency band, when the model reported one. */}
        {clip.freqLowHz !== null && clip.freqHighHz !== null ? (
          <div
            className="pointer-events-none absolute right-0 border-y border-dashed"
            style={{
              borderColor: "rgba(245,158,11,0.7)",
              left: 0,
              bottom: `${(clip.freqLowHz / MAX_PLOT_HZ) * 100}%`,
              height: `${((clip.freqHighHz - clip.freqLowHz) / MAX_PLOT_HZ) * 100}%`,
            }}
            title={`Reported band ${clip.freqLowHz}–${clip.freqHighHz} Hz`}
          />
        ) : null}

        {/* Playhead */}
        {usePrecomputed ? (
          <div
            className="pointer-events-none absolute top-0 h-full w-px"
            style={{ left: `${progress * 100}%`, background: "rgba(255,255,255,0.85)" }}
          />
        ) : null}
      </div>

      {!analysisAvailable && !usePrecomputed ? (
        <p className={`mt-1.5 ${TYPE.meta}`}>
          Live analysis is unavailable for this clip — the audio host did not
          permit cross-origin sample access. Playback is unaffected.
        </p>
      ) : null}

      {/* ── Transport ────────────────────────────────────────────────────── */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!clip.audioUrl}
          className="console-btn-primary"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={13} aria-hidden /> : <Play size={13} aria-hidden />}
          {playing ? "Pause" : "Play"}
        </button>

        <button
          type="button"
          onClick={restart}
          disabled={!clip.audioUrl}
          className="console-btn-quiet"
          aria-label="Restart"
        >
          <RotateCcw size={13} aria-hidden />
        </button>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={currentTime}
          onChange={(event) => {
            const audio = audioRef.current;
            const next = Number(event.target.value);
            if (audio) audio.currentTime = next;
            setCurrentTime(next);
          }}
          disabled={!clip.audioUrl || duration === 0}
          className="h-1 min-w-0 flex-1 accent-[var(--bt-emerald)]"
          aria-label="Seek"
        />

        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--bt-muted)]">
          {formatClock(currentTime)} / {formatClock(duration)}
        </span>
      </div>

      {error ? (
        <p className="mt-2 font-sans text-[11px]" style={{ color: "var(--bt-danger)" }}>
          {error}
        </p>
      ) : null}

      {clip.audioUrl ? (
        <audio
          ref={audioRef}
          src={clip.audioUrl}
          // Required for the analyser to read samples from a cross-origin clip.
          crossOrigin="anonymous"
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value)) setDuration(value);
          }}
          onError={() => setError("The clip could not be loaded. Its signed URL may have expired.")}
          className="hidden"
        />
      ) : (
        <p className={`mt-2 ${TYPE.meta}`}>
          No audio object is attached to this detection.
        </p>
      )}
    </div>
  );
}
