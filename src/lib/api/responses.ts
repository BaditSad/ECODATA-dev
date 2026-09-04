import { NextResponse } from "next/server";

/**
 * Uniform API envelope.
 *
 * Field firmware parses these responses on a metered 4G link, so the shape is
 * fixed and terse: a machine-readable `code` the device can branch on without
 * string-matching prose, and a `retryable` flag that tells it whether to keep
 * the clip queued on local flash or drop it.
 */

export type ApiErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "sensor_revoked"
  | "sensor_retired"
  | "tenant_inactive"
  | "invalid_payload"
  | "unsupported_codec"
  | "payload_too_large"
  | "rate_limited"
  | "storage_failure"
  | "internal_error"
  | "invalid_pin"
  | "pin_expired"
  | "invalid_lobby_code"
  | "invalid_remote_pass"
  | "not_on_network"
  | "method_not_allowed";

export interface ApiErrorBody {
  ok: false;
  code: ApiErrorCode;
  message: string;
  /** True when the device should hold the payload and try again later. */
  retryable: boolean;
}

export interface ApiSuccessBody<T> {
  ok: true;
  data: T;
}

const RETRYABLE: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
  "rate_limited",
  "storage_failure",
  "internal_error",
]);

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  headers?: HeadersInit
): NextResponse<ApiErrorBody> {
  return NextResponse.json<ApiErrorBody>(
    { ok: false, code, message, retryable: RETRYABLE.has(code) },
    { status, headers }
  );
}

export function apiSuccess<T>(
  data: T,
  status = 200,
  headers?: HeadersInit
): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json<ApiSuccessBody<T>>({ ok: true, data }, { status, headers });
}

/**
 * Message shown to a guest for any failed code entry.
 *
 * Intentionally identical for "wrong PIN" and "expired PIN": distinguishing
 * them tells an attacker probing the 10 000-value keyspace which guesses were
 * once real, which is exactly the oracle we must not provide.
 */
export const GENERIC_CODE_REJECTION =
  "That code isn't valid. Please check with reception.";
