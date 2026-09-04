/**
 * Canonical firmware endpoint: `POST /api/v1/telemetry/ingest`.
 *
 * This is the URL flashed into deployed balises. The implementation lives at
 * `/api/v1/ingest` so both paths share one code path rather than drifting
 * apart; changing either means changing the handler once.
 *
 * Route segment config cannot be re-exported — Next statically analyses these
 * declarations per route file — so they are restated here and must stay in
 * step with the implementation module.
 */

export { POST, GET } from "@/app/api/v1/ingest/route";

export const runtime = "edge";
export const dynamic = "force-dynamic";
