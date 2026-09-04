import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  hashSensorApiKey,
  looksLikeSensorApiKey,
} from "@/lib/auth/sensor-keys";
import { apiError, apiSuccess } from "@/lib/api/responses";
import {
  MAX_AUDIO_BYTES,
  MAX_JSON_BYTES,
  CODEC_MIME,
  audioObjectPath,
  decodeBase64,
  isPlausibleTimestamp,
  telemetryMetadataSchema,
  type TelemetryMetadata,
} from "@/lib/api/telemetry-schema";
import { STORAGE_BUCKETS, type AudioCodec, type IngestOutcome } from "@/types/database";

/**
 * IoT telemetry ingestion — the platform's highest-volume endpoint.
 *
 * A global fleet of autonomous balises posts here over 4G/LTE-M. The route is
 * built around three constraints that field hardware imposes:
 *
 *   1. **Never lose a clip to a slow dependency.** Classification is not done
 *      inline. The clip is stored, a job is enqueued, and the device gets its
 *      202 immediately. Model latency can never back-pressure the radio.
 *   2. **Always tell the device whether to retry.** Every response carries a
 *      `retryable` flag, so a unit knows whether to free local flash or hold
 *      the payload for the next window.
 *   3. **Log every attempt, including rejections.** A unit failing auth after
 *      a firmware flash is invisible otherwise — it simply stops appearing.
 *      `telemetry_ingest_log` is what makes that failure legible.
 *
 * Runs on the Edge: authentication is a single indexed hash lookup, so the
 * work is I/O-bound and benefits from terminating close to the device.
 */

export const runtime = "edge";
export const dynamic = "force-dynamic";

/** Sensors that report faster than this are almost certainly malfunctioning. */
const MIN_PING_INTERVAL_MS = 1_000;

interface AuthenticatedSensor {
  id: string;
  tenantId: string;
  hardwareId: string;
  name: string;
  status: string;
  lastPing: string | null;
  tenantActive: boolean;
  subscriptionStatus: string;
}

interface LogContext {
  sensorId?: string | null;
  tenantId?: string | null;
  hardwareId?: string | null;
  payloadBytes?: number | null;
  audioBytes?: number | null;
  audioCodec?: AudioCodec | null;
  durationMs?: number | null;
}

/**
 * Record the attempt, then respond.
 *
 * Logging is fire-and-forget by design: an ingest that succeeded must not be
 * reported as failed because the audit insert lost a race. A dropped log line
 * costs a row in a dashboard; a false failure costs a re-upload from a
 * battery-powered unit on a metered link.
 */
async function logAndRespond(
  outcome: IngestOutcome,
  response: NextResponse,
  context: LogContext,
  errorCode?: string,
  errorDetail?: string
): Promise<NextResponse> {
  try {
    const supabase = createAdminSupabase();
    await supabase.from("telemetry_ingest_log").insert({
      sensor_id: context.sensorId ?? null,
      tenant_id: context.tenantId ?? null,
      hardware_id: context.hardwareId ?? null,
      outcome,
      http_status: response.status,
      error_code: errorCode ?? null,
      error_detail: errorDetail ?? null,
      payload_bytes: context.payloadBytes ?? null,
      audio_bytes: context.audioBytes ?? null,
      audio_codec: context.audioCodec ?? null,
      duration_ms: context.durationMs ?? null,
    });
  } catch {
    // Audit is best-effort; the device's answer is what matters.
  }

  return response;
}

async function authenticate(
  request: NextRequest
): Promise<
  | { ok: true; sensor: AuthenticatedSensor }
  | { ok: false; response: NextResponse; outcome: IngestOutcome; errorCode: string }
> {
  const presented = request.headers.get("x-sensor-api-key");

  if (!presented) {
    return {
      ok: false,
      outcome: "rejected_auth",
      errorCode: "missing_api_key",
      response: apiError(
        "missing_api_key",
        "X-Sensor-API-Key header is required.",
        401
      ),
    };
  }

  // Shape check first: a scanner spraying this endpoint never reaches the DB.
  if (!looksLikeSensorApiKey(presented)) {
    return {
      ok: false,
      outcome: "rejected_auth",
      errorCode: "malformed_api_key",
      response: apiError("invalid_api_key", "API key is not recognised.", 401),
    };
  }

  const hash = await hashSensorApiKey(presented);
  const supabase = createAdminSupabase();

  const { data, error } = await supabase
    .from("sensors_balises")
    .select(
      "id, tenant_id, hardware_id, name, status, last_ping, api_key_revoked_at, tenants!inner(is_active, subscription_status)"
    )
    .eq("api_key_hash", hash)
    .is("api_key_revoked_at", null)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      outcome: "internal_error",
      errorCode: "auth_lookup_failed",
      response: apiError(
        "internal_error",
        "Could not verify credentials. Retry later.",
        503
      ),
    };
  }

  if (!data) {
    return {
      ok: false,
      outcome: "rejected_auth",
      errorCode: "unknown_api_key",
      response: apiError("invalid_api_key", "API key is not recognised.", 401),
    };
  }

  // The embedded relation arrives as an object for `!inner`, but the generated
  // types cannot express that, so narrow it explicitly.
  const tenant = data.tenants as unknown as {
    is_active: boolean;
    subscription_status: string;
  };

  return {
    ok: true,
    sensor: {
      id: data.id,
      tenantId: data.tenant_id,
      hardwareId: data.hardware_id,
      name: data.name,
      status: data.status,
      lastPing: data.last_ping,
      tenantActive: tenant.is_active,
      subscriptionStatus: tenant.subscription_status,
    },
  };
}

interface ParsedPayload {
  metadata: TelemetryMetadata;
  audio: Uint8Array | null;
  payloadBytes: number;
}

async function parsePayload(
  request: NextRequest
): Promise<
  | { ok: true; parsed: ParsedPayload }
  | { ok: false; response: NextResponse; errorCode: string; detail: string }
> {
  const contentType = request.headers.get("content-type") ?? "";

  const reject = (errorCode: string, detail: string, status = 422) => ({
    ok: false as const,
    errorCode,
    detail,
    response: apiError("invalid_payload", detail, status),
  });

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return reject("malformed_multipart", "Request body is not valid multipart/form-data.", 400);
    }

    const metadataRaw = form.get("metadata");
    if (typeof metadataRaw !== "string") {
      return reject("missing_metadata", "A 'metadata' JSON part is required.");
    }

    let metadataJson: unknown;
    try {
      metadataJson = JSON.parse(metadataRaw);
    } catch {
      return reject("malformed_metadata", "The 'metadata' part is not valid JSON.");
    }

    const validated = telemetryMetadataSchema.safeParse(metadataJson);
    if (!validated.success) {
      return reject("schema_violation", validated.error.issues[0]?.message ?? "Invalid metadata.");
    }

    const audioPart = form.get("audio");
    let audio: Uint8Array | null = null;

    if (audioPart instanceof Blob) {
      if (audioPart.size > MAX_AUDIO_BYTES) {
        return {
          ok: false,
          errorCode: "audio_too_large",
          detail: `Audio exceeds the ${MAX_AUDIO_BYTES} byte limit.`,
          response: apiError(
            "payload_too_large",
            `Audio exceeds the ${MAX_AUDIO_BYTES} byte limit.`,
            413
          ),
        };
      }
      audio = new Uint8Array(await audioPart.arrayBuffer());
    }

    if (audio && !validated.data.audio) {
      return reject("missing_audio_metadata", "audio metadata is required when an audio part is sent.");
    }

    return {
      ok: true,
      parsed: {
        metadata: validated.data,
        audio,
        payloadBytes: metadataRaw.length + (audio?.byteLength ?? 0),
      },
    };
  }

  if (contentType.includes("application/json")) {
    const body = await request.text();

    if (body.length > MAX_JSON_BYTES) {
      return {
        ok: false,
        errorCode: "json_too_large",
        detail: `JSON body exceeds the ${MAX_JSON_BYTES} byte limit.`,
        response: apiError(
          "payload_too_large",
          `JSON body exceeds the ${MAX_JSON_BYTES} byte limit.`,
          413
        ),
      };
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return reject("malformed_json", "Request body is not valid JSON.", 400);
    }

    const validated = telemetryMetadataSchema.safeParse(json);
    if (!validated.success) {
      return reject("schema_violation", validated.error.issues[0]?.message ?? "Invalid payload.");
    }

    let audio: Uint8Array | null = null;
    if (validated.data.audioBase64) {
      try {
        audio = decodeBase64(validated.data.audioBase64);
      } catch {
        return reject("malformed_base64", "audioBase64 is not valid base64.");
      }
      if (audio.byteLength > MAX_AUDIO_BYTES) {
        return {
          ok: false,
          errorCode: "audio_too_large",
          detail: `Decoded audio exceeds the ${MAX_AUDIO_BYTES} byte limit.`,
          response: apiError(
            "payload_too_large",
            `Decoded audio exceeds the ${MAX_AUDIO_BYTES} byte limit.`,
            413
          ),
        };
      }
    }

    return {
      ok: true,
      parsed: { metadata: validated.data, audio, payloadBytes: body.length },
    };
  }

  return {
    ok: false,
    errorCode: "unsupported_content_type",
    detail: "Content-Type must be multipart/form-data or application/json.",
    response: apiError(
      "invalid_payload",
      "Content-Type must be multipart/form-data or application/json.",
      415
    ),
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Authenticate the balise ────────────────────────────────────────────
  const auth = await authenticate(request);
  if (!auth.ok) {
    return logAndRespond(
      auth.outcome,
      auth.response,
      { hardwareId: request.headers.get("x-sensor-hardware-id") },
      auth.errorCode
    );
  }

  const { sensor } = auth;
  const logBase: LogContext = {
    sensorId: sensor.id,
    tenantId: sensor.tenantId,
    hardwareId: sensor.hardwareId,
  };

  // ── 2. Authorize the unit and its tenant ──────────────────────────────────
  if (sensor.status === "retired") {
    return logAndRespond(
      "rejected_auth",
      apiError(
        "sensor_retired",
        "This balise has been retired. Stop transmitting.",
        403
      ),
      logBase,
      "sensor_retired"
    );
  }

  if (!sensor.tenantActive || sensor.subscriptionStatus === "churned") {
    return logAndRespond(
      "rejected_quota",
      apiError(
        "tenant_inactive",
        "The resort associated with this balise is no longer active.",
        403
      ),
      logBase,
      "tenant_inactive"
    );
  }

  // ── 3. Parse and validate ─────────────────────────────────────────────────
  const payload = await parsePayload(request);
  if (!payload.ok) {
    const outcome: IngestOutcome =
      payload.response.status === 413 ? "rejected_payload" : "rejected_payload";
    return logAndRespond(
      outcome,
      payload.response,
      logBase,
      payload.errorCode,
      payload.detail
    );
  }

  const { metadata, audio, payloadBytes } = payload.parsed;

  // A key presented by hardware other than the unit it was issued to is a
  // cloned credential, not a misconfiguration. Refuse and make it auditable.
  if (metadata.hardwareId && metadata.hardwareId !== sensor.hardwareId) {
    return logAndRespond(
      "rejected_auth",
      apiError(
        "invalid_api_key",
        "Reported hardware ID does not match the credential.",
        401
      ),
      { ...logBase, payloadBytes },
      "hardware_id_mismatch",
      `reported=${metadata.hardwareId} expected=${sensor.hardwareId}`
    );
  }

  // ── 4. Resolve the event timestamp ────────────────────────────────────────
  const now = new Date();
  let recordedAt = now;

  if (metadata.recordedAt) {
    const reported = new Date(metadata.recordedAt);
    // Substitute server time rather than rejecting: a unit with a dead RTC
    // still produces a valuable clip, and dropping it would lose real data.
    if (Number.isFinite(reported.getTime()) && isPlausibleTimestamp(reported, now)) {
      recordedAt = reported;
    }
  }

  // Flood guard. A unit stuck in a reboot loop can otherwise generate
  // thousands of rows a minute and distort every tenant-level metric.
  if (sensor.lastPing) {
    const since = now.getTime() - new Date(sensor.lastPing).getTime();
    if (since >= 0 && since < MIN_PING_INTERVAL_MS) {
      return logAndRespond(
        "rejected_quota",
        apiError(
          "rate_limited",
          "Reporting too frequently. Back off and retry.",
          429,
          { "Retry-After": "60" }
        ),
        { ...logBase, payloadBytes },
        "ping_interval_violation"
      );
    }
  }

  const supabase = createAdminSupabase();
  const codec = metadata.audio?.codec ?? null;

  const logWithPayload: LogContext = {
    ...logBase,
    payloadBytes,
    audioBytes: audio?.byteLength ?? null,
    audioCodec: codec,
    durationMs: metadata.audio?.durationMs ?? null,
  };

  // ── 5. Persist audio to the vault ─────────────────────────────────────────
  let objectPath: string | null = null;

  if (audio && codec) {
    objectPath = audioObjectPath({
      tenantId: sensor.tenantId,
      sensorId: sensor.id,
      recordedAt,
      codec,
      uniqueId: crypto.randomUUID(),
    });

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.audioVault)
      .upload(objectPath, audio, {
        contentType: CODEC_MIME[codec],
        // Paths embed a UUID, so a collision means a retry of the same clip.
        upsert: false,
        cacheControl: "31536000",
      });

    if (uploadError) {
      // Retryable on purpose: the clip still exists on the device's flash, and
      // a transient storage fault must not silently discard a detection.
      return logAndRespond(
        "storage_error",
        apiError(
          "storage_failure",
          "Audio could not be stored. Retain the clip and retry.",
          503,
          { "Retry-After": "120" }
        ),
        logWithPayload,
        "storage_upload_failed",
        uploadError.message
      );
    }
  }

  // ── 6. Commit health, detection and queue entry atomically ────────────────
  const { data: applied, error: applyError } = await supabase.rpc(
    "apply_sensor_telemetry",
    {
      target_sensor: sensor.id,
      pinged_at: recordedAt.toISOString(),
      battery: metadata.battery?.level ?? null,
      voltage: metadata.battery?.voltage ?? null,
      solar_mv: metadata.battery?.solarInputMv ?? null,
      rssi_dbm: metadata.radio?.rssiDbm ?? null,
      firmware: metadata.firmwareVersion ?? null,
      audio_object_path: objectPath,
      audio_codec: codec,
      audio_duration_ms: metadata.audio?.durationMs ?? null,
      audio_sample_rate: metadata.audio?.sampleRateHz ?? null,
      species: metadata.detection?.speciesName ?? null,
      species_latin: metadata.detection?.latinName ?? null,
      confidence: metadata.detection?.confidence ?? null,
      model: metadata.detection?.modelVersion ?? null,
      // The stored object path, not a signed URL: signatures expire, and this
      // column is read months later by the reporting pipeline.
      clip_url: objectPath,
      spectrogram: null,
    }
  );

  if (applyError) {
    return logAndRespond(
      "internal_error",
      apiError(
        "internal_error",
        "Telemetry could not be recorded. Retry later.",
        503,
        { "Retry-After": "60" }
      ),
      logWithPayload,
      "apply_telemetry_failed",
      applyError.message
    );
  }

  const result = Array.isArray(applied) ? applied[0] : applied;

  // ── 7. Acknowledge ────────────────────────────────────────────────────────
  // 202, not 200: the clip is durably stored but not yet classified.
  return logAndRespond(
    "accepted",
    apiSuccess(
      {
        sensorId: sensor.id,
        acknowledgedAt: now.toISOString(),
        recordedAt: recordedAt.toISOString(),
        storedObjectPath: objectPath,
        detectionId: result?.detection_id ?? null,
        inferenceJobId: result?.job_id ?? null,
      },
      202
    ),
    logWithPayload
  );
}

/** Cheap liveness probe for firmware to confirm connectivity before uploading. */
export async function GET(): Promise<NextResponse> {
  return apiSuccess({
    service: "ecodatalink-telemetry-ingest",
    version: "v1",
    acceptedContentTypes: ["multipart/form-data", "application/json"],
    maxAudioBytes: MAX_AUDIO_BYTES,
    serverTime: new Date().toISOString(),
  });
}
