"use client";

import { useState, useTransition } from "react";
import { updateLobbySettings } from "@/app/(tenant)/hotel-portal/actions";
import { TYPE } from "@/components/console/ui";
import type { LobbyDisplaySettingsRow, SpeciesProfileRow } from "@/types/database";

/**
 * Hall display controls.
 *
 * A plain form posting to a Server Action, deliberately: these settings are
 * read by wall-mounted screens on their own polling cycle, so optimistic local
 * state would show the operator a change the display has not taken yet.
 */
export function LobbyControls({
  settings,
  species,
  canEdit,
}: {
  settings: LobbyDisplaySettingsRow | null;
  species: SpeciesProfileRow[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );

  function onSubmit(formData: FormData) {
    setNotice(null);
    startTransition(async () => {
      const result = await updateLobbySettings(formData);
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
    });
  }

  return (
    <form action={onSubmit} className="px-4 py-3.5">
      <fieldset disabled={!canEdit || pending} className="contents">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={TYPE.eyebrow}>Featured species</span>
            <select
              name="featuredSpeciesId"
              defaultValue={settings?.featured_species_id ?? ""}
              className="console-input mt-1.5 h-8"
            >
              <option value="">Rotate through recent detections</option>
              {species.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.common_name_en} — {entry.latin_name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={TYPE.eyebrow}>Soundscape</span>
            <select
              name="soundscapeMode"
              defaultValue={settings?.soundscape_mode ?? "ambient"}
              className="console-input mt-1.5 h-8"
            >
              <option value="muted">Muted</option>
              <option value="ambient">Ambient loop</option>
              <option value="live_detections">Live detections</option>
            </select>
          </label>

          <label className="block">
            <span className={TYPE.eyebrow}>Volume</span>
            <span className={`mt-0.5 block ${TYPE.meta}`}>
              Percentage of the display&apos;s own output level.
            </span>
            <input
              name="soundscapeVolume"
              type="number"
              min={0}
              max={100}
              defaultValue={settings?.soundscape_volume ?? 40}
              className="console-input mt-1.5 h-8 font-mono"
            />
          </label>

          <label className="block">
            <span className={TYPE.eyebrow}>Camera</span>
            <select
              name="cameraMode"
              defaultValue={settings?.camera_mode ?? "orbit"}
              className="console-input mt-1.5 h-8"
            >
              <option value="orbit">Slow orbit</option>
              <option value="flyover">Flyover</option>
              <option value="static">Static framing</option>
            </select>
          </label>

          <label className="block">
            <span className={TYPE.eyebrow}>Orbit period (s)</span>
            <span className={`mt-0.5 block ${TYPE.meta}`}>
              One full revolution. Longer is calmer for a lobby.
            </span>
            <input
              name="orbitPeriodS"
              type="number"
              min={20}
              max={600}
              defaultValue={settings?.orbit_period_s ?? 90}
              className="console-input mt-1.5 h-8 font-mono"
            />
          </label>

          <label className="block">
            <span className={TYPE.eyebrow}>Language</span>
            <select
              name="locale"
              defaultValue={settings?.locale ?? "fr"}
              className="console-input mt-1.5 h-8"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="showLiveAlerts"
              defaultChecked={settings?.show_live_alerts ?? true}
              className="h-3.5 w-3.5 accent-[var(--bt-emerald)]"
            />
            <span className="font-sans text-[12px] text-[var(--bt-text-soft)]">
              Show live detection alerts
            </span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="showSpeciesNames"
              defaultChecked={settings?.show_species_names ?? true}
              className="h-3.5 w-3.5 accent-[var(--bt-emerald)]"
            />
            <span className="font-sans text-[12px] text-[var(--bt-text-soft)]">
              Show species names on screen
            </span>
          </label>
        </div>

        {notice ? (
          <p
            className="mt-3 font-sans text-[11px]"
            style={{
              color: notice.tone === "ok" ? "var(--bt-emerald)" : "var(--bt-danger)",
            }}
            role="status"
          >
            {notice.text}
          </p>
        ) : null}

        {canEdit ? (
          <button type="submit" className="console-btn-primary mt-3">
            {pending ? "Saving…" : "Save display settings"}
          </button>
        ) : (
          <p className={`mt-3 ${TYPE.meta}`}>
            Read-only. Lobby settings are changed by the resort manager.
          </p>
        )}
      </fieldset>
    </form>
  );
}
