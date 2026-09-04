"use client";

import { useRef, useState, useTransition } from "react";
import { UploadCloud } from "lucide-react";
import {
  createTwinAssetUploadUrl,
  registerTwinAsset,
} from "@/modules/domains/actions/twin";
import { createClient } from "@/lib/supabase/client";
import { TYPE } from "@/components/console/ui";
import { formatBytes } from "@/lib/format";
import { STORAGE_BUCKETS, type Asset3dKind } from "@/types/database";
import { useMessages } from "@/i18n/LocaleProvider";

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

const KIND_VALUES: Asset3dKind[] = ["glb", "gltf", "point_cloud", "heightmap"];

const KIND_ACCEPT: Record<Asset3dKind, string> = {
  glb: ".glb",
  gltf: ".gltf",
  point_cloud: ".ply,.laz,.las",
  heightmap: ".png",
};

type Phase = "idle" | "authorising" | "uploading" | "registering";

export function TwinAssetUploader({ tenantId }: { tenantId: string }) {
  const t = useMessages();
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
  const accept = KIND_ACCEPT[kind];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    if (!file) {
      setNotice({ tone: "error", text: t.twin.file });
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
      setNotice({ tone: "error", text: uploadError.message });
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
          <span className={TYPE.eyebrow}>{t.twin.kind}</span>
          <select
            name="assetKind"
            value={kind}
            onChange={(event) => setKind(event.target.value as Asset3dKind)}
            className="console-input mt-1.5 h-8"
          >
            {KIND_VALUES.map((value) => (
              <option key={value} value={value}>
                {value === "glb"
                  ? t.twin.kindGlb
                  : value === "gltf"
                    ? t.twin.kindGltf
                    : value === "point_cloud"
                      ? t.twin.kindPointCloud
                      : t.twin.kindHeightmap}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.twin.label}</span>
          <input
            name="label"
            required
            maxLength={120}
            placeholder={t.twin.placeholder}
            className="console-input mt-1.5 h-8"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className={TYPE.eyebrow}>{t.twin.file}</span>
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

      <p className={`mt-4 ${TYPE.eyebrow}`}>{t.domains.geo}</p>
      <p className={`mt-0.5 ${TYPE.meta}`}>{t.domains.geoHint}</p>

      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className={TYPE.eyebrow}>{t.twin.lat}</span>
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
          <span className={TYPE.eyebrow}>{t.twin.lon}</span>
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
          <span className={TYPE.eyebrow}>{t.twin.alt}</span>
          <input
            name="originAltM"
            type="number"
            step="0.1"
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>
        <label className="block">
          <span className={TYPE.eyebrow}>{t.twin.heading}</span>
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
          <span className={TYPE.eyebrow}>{t.twin.span}</span>
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
          {t.twin.publish}
        </span>
      </label>

      {busy ? (
        <div className="mt-3">
          <p className={TYPE.meta}>{t.twin.uploading}</p>
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
        {busy ? t.twin.uploading : t.twin.upload}
      </button>
    </form>
  );
}
