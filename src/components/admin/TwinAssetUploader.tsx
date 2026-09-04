"use client";

import { useRef, useState, useTransition } from "react";
import { UploadCloud } from "lucide-react";
import {
  createTwinAssetUploadUrl,
  registerTwinAsset,
} from "@/app/(admin)/admin/clients/[id]/actions";
import { createClient } from "@/lib/supabase/client";
import { TYPE } from "@/components/console/ui";
import { formatBytes } from "@/lib/format";
import { STORAGE_BUCKETS, type Asset3dKind } from "@/types/database";

/**
 * 3D twin asset upload.
 *
 * Three steps, in this order for a reason:
 *   1. Ask the server for a scoped, single-use upload token.
 *   2. Send the bytes from the browser straight to Supabase Storage. Twin
 *      meshes reach hundreds of megabytes; proxying them through a Server
 *      Action would exceed the body limit and pay for the transfer twice.
 *   3. Register the metadata, which is also where georeferencing is validated.
 *
 * The asset is only reachable by the guest view after step 3 publishes it, so
 * an upload that dies midway leaves an orphaned object rather than a broken twin.
 */

const KIND_OPTIONS: { value: Asset3dKind; label: string; accept: string }[] = [
  { value: "glb", label: "glTF binary (.glb)", accept: ".glb" },
  { value: "gltf", label: "glTF JSON (.gltf)", accept: ".gltf" },
  { value: "point_cloud", label: "Point cloud (.ply / .laz)", accept: ".ply,.laz,.las" },
  { value: "heightmap", label: "Heightmap (.png)", accept: ".png" },
];

type Phase = "idle" | "authorising" | "uploading" | "registering";

export function TwinAssetUploader({ tenantId }: { tenantId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<Asset3dKind>("glb");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );

  const busy = phase !== "idle";
  const accept = KIND_OPTIONS.find((option) => option.value === kind)?.accept ?? "";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    if (!file) {
      setNotice({ tone: "error", text: "Choose an asset file first." });
      return;
    }

    setNotice(null);
    setProgress(0);

    // 1. Authorise.
    setPhase("authorising");
    const authorised = await createTwinAssetUploadUrl(tenantId, file.name);

    if (!authorised.ok || !authorised.data) {
      setPhase("idle");
      setNotice({ tone: "error", text: authorised.message });
      return;
    }

    // 2. Upload direct to storage.
    setPhase("uploading");
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.twinAssets)
      .uploadToSignedUrl(authorised.data.objectPath, authorised.data.token, file, {
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      setPhase("idle");
      setNotice({ tone: "error", text: `Upload failed: ${uploadError.message}` });
      return;
    }

    setProgress(100);

    // 3. Register metadata.
    setPhase("registering");
    formData.set("objectPath", authorised.data.objectPath);
    formData.set("fileBytes", String(file.size));

    startTransition(async () => {
      const result = await registerTwinAsset(formData);
      setPhase("idle");
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
      if (result.ok) {
        form.reset();
        setFile(null);
        setProgress(0);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="px-4 py-3.5">
      <input type="hidden" name="tenantId" value={tenantId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={TYPE.eyebrow}>Asset kind</span>
          <select
            name="assetKind"
            value={kind}
            onChange={(event) => setKind(event.target.value as Asset3dKind)}
            className="console-input mt-1.5 h-8"
          >
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>Label</span>
          <input
            name="label"
            required
            maxLength={120}
            placeholder="Photogrammetry scan — Feb 2026"
            className="console-input mt-1.5 h-8"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className={TYPE.eyebrow}>File</span>
          <input
            type="file"
            accept={accept}
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="console-input mt-1.5 h-8 py-1 file:mr-2 file:rounded file:border-0 file:bg-[var(--edl-border-strong)] file:px-2 file:py-0.5 file:font-sans file:text-[11px] file:text-[var(--edl-text)]"
          />
          {file ? (
            <span className={`mt-1 block ${TYPE.meta}`}>
              {file.name} · {formatBytes(file.size)}
            </span>
          ) : null}
        </label>
      </div>

      <p className={`mt-4 ${TYPE.eyebrow}`}>Georeferencing</p>
      <p className={`mt-0.5 ${TYPE.meta}`}>
        Anchors the mesh to the real world so sensor GPS fixes land in the right
        place on the twin. Heading is the mesh&apos;s +Z axis relative to true north.
      </p>

      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className={TYPE.eyebrow}>Origin lat</span>
          <input
            name="originLat"
            type="number"
            step="0.0000001"
            min={-90}
            max={90}
            required
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>
        <label className="block">
          <span className={TYPE.eyebrow}>Origin lon</span>
          <input
            name="originLon"
            type="number"
            step="0.0000001"
            min={-180}
            max={180}
            required
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>
        <label className="block">
          <span className={TYPE.eyebrow}>Altitude (m)</span>
          <input
            name="originAltM"
            type="number"
            step="0.1"
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>
        <label className="block">
          <span className={TYPE.eyebrow}>Heading (°)</span>
          <input
            name="headingDeg"
            type="number"
            step="0.1"
            min={0}
            max={359.9}
            defaultValue={0}
            required
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>
        <label className="block">
          <span className={TYPE.eyebrow}>Span (m)</span>
          <input
            name="spanMeters"
            type="number"
            step="0.1"
            min={0.1}
            defaultValue={60}
            required
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2">
        <input
          type="checkbox"
          name="publish"
          className="h-3.5 w-3.5 accent-[var(--edl-emerald)]"
        />
        <span className="font-sans text-[12px] text-[var(--edl-text-soft)]">
          Publish as the live twin
        </span>
        <span className={TYPE.meta}>
          — retires the current published version for this resort
        </span>
      </label>

      {busy ? (
        <div className="mt-3">
          <p className={TYPE.meta}>
            {phase === "authorising"
              ? "Authorising upload…"
              : phase === "uploading"
                ? `Uploading ${file ? formatBytes(file.size) : ""}…`
                : "Registering asset…"}
          </p>
          <span className="mt-1.5 block h-[3px] w-full overflow-hidden rounded-full bg-[var(--edl-border)]">
            <span
              className="block h-full rounded-full transition-[width] duration-300"
              style={{
                width: phase === "uploading" ? `${Math.max(8, progress)}%` : "100%",
                background: "var(--edl-emerald)",
              }}
            />
          </span>
        </div>
      ) : null}

      {notice ? (
        <p
          className="mt-3 font-sans text-[11px]"
          style={{
            color: notice.tone === "ok" ? "var(--edl-emerald)" : "var(--edl-danger)",
          }}
          role="status"
        >
          {notice.text}
        </p>
      ) : null}

      <button type="submit" disabled={busy} className="console-btn-primary mt-3">
        <UploadCloud size={13} aria-hidden />
        {busy ? "Working…" : "Upload asset"}
      </button>
    </form>
  );
}
