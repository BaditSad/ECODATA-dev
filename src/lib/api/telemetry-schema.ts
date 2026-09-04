import { z } from "zod";
import type { AudioCodec } from "@/types/database";

/**
 * Wire contract for `POST /api/v1/telemetry/ingest`.
 *
 * Two encodings are accepted because the fleet is not homogeneous:
 *   • `multipart/form-data` — a `metadata` JSON part plus a binary `audio`
 *     part. Preferred: no base64 inflation on a metered LTE-M link.
 *   • `application/json` — the same metadata with base64 audio inline, for
 *     constrained firmware whose HTTP stack cannot build a multipart body.
 *
 * Every field except the codec is optional so a balise can send a bare
 * health ping with no clip, which is the common case between detections.
 */

export const AUDIO_CODECS = ["opus", "aac", "flac", "wav"] as const;

export const CODEC_EXTENSION: Record<AudioCodec, string> = {
  opus: "opus",
  aac: "m4a",
  flac: "flac",
  wav: "wav",
};

export const CODEC_MIME: Record<AudioCodec, string> = {
  opus: "audio/opus",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
};

/** Bucket ceiling is 25 MiB; reject above it before spending an upload. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Guards the JSON path, where base64 inflates payloads by a third. */
export const MAX_JSON_BYTES = 8 * 1024 * 1024;

const isoTimestamp = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime());

export const batterySchema = z.object({
  level: z.number().int().min(0).max(100).optional(),
  // LiFePO4 pack: ~2.5 V empty to ~3.65 V full per cell, so a 4S pack tops
  // out near 14.6 V. The bound is generous to accommodate other pack sizes.
  voltage: z.number().min(0).max(99.99).optional(),
  solarInputMv: z.number().int().min(0).max(60_000).optional(),
});

export const radioSchema = z.object({
  // RSRP on 4G/LTE-M. -44 is an excellent signal, -140 is the edge of usable.
  rssiDbm: z.number().int().min(-140).max(0).optional(),
});

export const audioMetaSchema = z.object({
  codec: z.enum(AUDIO_CODECS),
  durationMs: z.number().int().min(0).max(600_000).optional(),
  sampleRateHz: z.number().int().min(4_000).max(384_000).optional(),
  sizeBytes: z.number().int().min(0).max(MAX_AUDIO_BYTES).optional(),
});

/**
 * An on-device classification, when the balise runs an edge model.
 *
 * Absent means "raw clip, classify in the cloud" — the queue picks it up at a
 * higher priority precisely because nothing has labelled it yet.
 */
export const detectionSchema = z.object({
  speciesName: z.string().min(1).max(255),
  latinName: z.string().min(1).max(255).optional(),
  confidence: z.number().min(0).max(1),
  modelVersion: z.string().min(1).max(64).optional(),
  freqLowHz: z.number().int().min(0).max(200_000).optional(),
  freqHighHz: z.number().int().min(0).max(200_000).optional(),
});

export const telemetryMetadataSchema = z
  .object({
    /**
     * Optional self-report. When present it must match the unit the API key
     * resolves to: a mismatch means a key has been copied onto other hardware.
     */
    hardwareId: z.string().min(1).max(64).optional(),
    recordedAt: isoTimestamp.optional(),
    firmwareVersion: z.string().min(1).max(32).optional(),
    battery: batterySchema.optional(),
    radio: radioSchema.optional(),
    audio: audioMetaSchema.optional(),
    detection: detectionSchema.optional(),
    /** Base64 clip; JSON encoding only. */
    audioBase64: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.detection === undefined ||
      value.detection.freqHighHz === undefined ||
      value.detection.freqLowHz === undefined ||
      value.detection.freqHighHz >= value.detection.freqLowHz,
    { message: "freqHighHz must be greater than or equal to freqLowHz", path: ["detection"] }
  )
  .refine((value) => value.audioBase64 === undefined || value.audio !== undefined, {
    message: "audio metadata is required when audioBase64 is present",
    path: ["audio"],
  });

export type TelemetryMetadata = z.infer<typeof telemetryMetadataSchema>;

/**
 * Reject a clock that is implausibly far off before it corrupts a time series.
 *
 * Field units drift and some boot with no RTC at all, reporting 1970. Rather
 * than trust or discard the reading, the caller substitutes server time.
 */
export function isPlausibleTimestamp(
  candidate: Date,
  now: Date = new Date()
): boolean {
  const skewMs = candidate.getTime() - now.getTime();
  const sevenDays = 7 * 86_400_000;
  const oneHour = 3_600_000;
  // Generous in the past (a unit flushing a backlog after days offline),
  // strict in the future (no legitimate reason to lead server time).
  return skewMs < oneHour && skewMs > -sevenDays;
}

/** Decode base64 to bytes without Buffer, so the route stays Edge-compatible. */
export function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Storage key for a clip.
 *
 * Leading segment is the tenant id, which the storage RLS policy reads as the
 * tenant claim. The date hierarchy keeps any single prefix small enough to
 * list, which matters once a 7-balise site has run for a year.
 */
export function audioObjectPath(params: {
  tenantId: string;
  sensorId: string;
  recordedAt: Date;
  codec: AudioCodec;
  uniqueId: string;
}): string {
  const { tenantId, sensorId, recordedAt, codec, uniqueId } = params;
  const year = recordedAt.getUTCFullYear();
  const month = String(recordedAt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(recordedAt.getUTCDate()).padStart(2, "0");
  const stamp = recordedAt.toISOString().replace(/[:.]/g, "-");

  return `${tenantId}/${sensorId}/${year}/${month}/${day}/${stamp}_${uniqueId}.${CODEC_EXTENSION[codec]}`;
}
