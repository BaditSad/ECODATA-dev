import type { Metadata } from "next";
import { requireGuestSession } from "@/lib/auth/guards";
import { fetchGuestTwinView } from "@/lib/data/guest";
import {
  GuestExperience,
  type GuestDetection,
} from "@/components/client/GuestExperience";

export const metadata: Metadata = { title: "Living inventory" };

// A guest's whole reason for opening this is "what was heard just now", so the
// page is never cached.
export const dynamic = "force-dynamic";

/** Fallback footprint when a resort has not been georeferenced yet. */
const DEFAULT_SPAN_METERS = 60;

export default async function GuestViewPage() {
  // The tenant id comes from the HMAC-verified session cookie and nowhere else.
  // This is the invariant the guest data layer relies on in place of RLS.
  const session = await requireGuestSession();
  const view = await fetchGuestTwinView(session.tenantId);

  // Prefer the published asset's own georeferencing, then the tenant mirror,
  // then a neutral default so the twin always renders something.
  const origin = {
    lat: view.twinAsset?.origin_lat ?? view.tenant.coordinates?.lat ?? 0,
    lon: view.twinAsset?.origin_lon ?? view.tenant.coordinates?.lon ?? 0,
    alt: view.tenant.coordinates?.alt ?? 0,
  };

  const headingDeg =
    view.twinAsset?.heading_deg ?? view.tenant.coordinates?.headingDeg ?? 0;

  const spanMeters =
    view.twinAsset?.span_meters ??
    view.tenant.coordinates?.spanMeters ??
    DEFAULT_SPAN_METERS;

  const detections: GuestDetection[] = view.detections.map((card) => ({
    detectionId: card.detectionId,
    speciesName: card.profile?.common_name_en ?? card.speciesName,
    latinName: card.latinName ?? card.profile?.latin_name ?? null,
    detectedAt: card.detectedAt,
    sensorName: card.sensorName,
    audioUrl: card.audioUrl,
    spectrogramUrl: card.spectrogramUrl,
    description: card.profile?.description_en ?? null,
    imageUrl: card.profile?.image_url ?? null,
    category: card.profile?.category ?? null,
    iucnStatus: card.profile?.iucn_status ?? null,
    sizeLabel: card.profile?.size_label ?? null,
    weightLabel: card.profile?.weight_label ?? null,
    maxAgeLabel: card.profile?.max_age_label ?? null,
  }));

  return (
    <GuestExperience
      resortName={view.tenant.name}
      slug={view.tenant.slug}
      assetUrl={view.twinAssetUrl}
      origin={origin}
      headingDeg={headingDeg}
      spanMeters={spanMeters}
      sensors={view.sensors}
      detections={detections}
      renderedAt={Date.now()}
    />
  );
}
