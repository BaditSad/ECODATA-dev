import type { Metadata } from "next";
import { requireLobbySession } from "@/lib/auth/guards";
import { fetchGuestTwinView } from "@/lib/data/guest";
import { LobbyKiosk } from "@/components/lobby/LobbyKiosk";

export const metadata: Metadata = { title: "BioTwin display" };

export const dynamic = "force-dynamic";

const DEFAULT_SPAN_METERS = 60;

/**
 * Hall display.
 *
 * Shares the twin and the data layer with the guest view so the screen in the
 * lobby and the phone in a guest's hand cannot disagree about the estate.
 */
export default async function LobbyPage() {
  const session = await requireLobbySession();
  const view = await fetchGuestTwinView(session.tenantId);

  const settings = view.lobbySettings;

  const origin = {
    lat: view.twinAsset?.origin_lat ?? view.tenant.coordinates?.lat ?? 0,
    lon: view.twinAsset?.origin_lon ?? view.tenant.coordinates?.lon ?? 0,
    alt: view.tenant.coordinates?.alt ?? 0,
  };

  return (
    <LobbyKiosk
      resortName={view.tenant.name}
      slug={view.tenant.slug}
      assetUrl={view.twinAssetUrl}
      origin={origin}
      headingDeg={
        view.twinAsset?.heading_deg ?? view.tenant.coordinates?.headingDeg ?? 0
      }
      spanMeters={
        view.twinAsset?.span_meters ??
        view.tenant.coordinates?.spanMeters ??
        DEFAULT_SPAN_METERS
      }
      sensors={view.sensors}
      initialDetections={view.detections.slice(0, 8).map((card) => ({
        id: card.detectionId,
        speciesName: card.profile?.common_name_en ?? card.speciesName,
        latinName: card.latinName ?? card.profile?.latin_name ?? null,
        detectedAt: card.detectedAt,
      }))}
      featuredSpecies={
        view.featuredSpecies
          ? {
              commonName:
                settings?.locale === "fr"
                  ? view.featuredSpecies.common_name_fr
                  : view.featuredSpecies.common_name_en,
              latinName: view.featuredSpecies.latin_name,
              description:
                settings?.locale === "fr"
                  ? view.featuredSpecies.description_fr
                  : view.featuredSpecies.description_en,
              imageUrl: view.featuredSpecies.image_url,
            }
          : null
      }
      cameraMode={settings?.camera_mode ?? "orbit"}
      orbitPeriodSeconds={settings?.orbit_period_s ?? 90}
      soundscapeMode={settings?.soundscape_mode ?? "ambient"}
      showLiveAlerts={settings?.show_live_alerts ?? true}
      showSpeciesNames={settings?.show_species_names ?? true}
      locale={settings?.locale ?? "en"}
    />
  );
}
