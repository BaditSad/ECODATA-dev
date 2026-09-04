"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import {
  provisionSensor,
  type ProvisionedSensorPayload,
} from "@/modules/domains/actions/fleet";
import { TYPE } from "@/components/console/ui";
import { useMessages } from "@/i18n/LocaleProvider";

/**
 * Balise provisioning.
 *
 * The credential is shown once and only once. That constraint drives the whole
 * component: the key lives in local state, is never re-fetched, and the panel
 * makes the operator dismiss it deliberately so it cannot be scrolled past and
 * lost.
 */
export function ProvisionSensorForm({ tenantId }: { tenantId: string }) {
  const t = useMessages();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<ProvisionedSensorPayload | null>(null);
  const [copied, setCopied] = useState(false);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await provisionSensor(formData);
      if (result.ok && result.data) {
        setIssued(result.data);
        setCopied(false);
        formRef.current?.reset();
      } else {
        setError(result.message);
      }
    });
  }

  async function copyKey() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.rawApiKey);
      setCopied(true);
    } catch {
      // Clipboard access can be denied; the key stays selectable on screen.
      setCopied(false);
    }
  }

  if (issued) {
    return (
      <div className="px-4 py-3.5">
        <div
          className="rounded-md border p-3"
          style={{
            borderColor: "var(--edl-gold-40)",
            background: "var(--edl-gold-10)",
          }}
        >
          <p className="flex items-center gap-1.5 font-sans text-[12px] font-medium text-[var(--edl-text)]">
            <KeyRound size={13} aria-hidden />
            {issued.name}
          </p>
          <p className={`mt-1 ${TYPE.meta}`}>{t.provision.keyOnce}</p>

          <div className="mt-2.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded border border-[var(--edl-border-strong)] bg-[var(--edl-bg)] px-2.5 py-2 font-mono text-[11px] text-[var(--edl-text)]">
              {issued.rawApiKey}
            </code>
            <button type="button" onClick={copyKey} className="console-btn-secondary">
              {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
              {copied ? t.copied : t.copy}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIssued(null)}
            className="console-btn-primary mt-3"
          >
            {t.back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={onSubmit} className="px-4 py-3.5">
      <input type="hidden" name="tenantId" value={tenantId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={TYPE.eyebrow}>{t.provision.name}</span>
          <input
            name="name"
            required
            maxLength={100}
            placeholder="BBI #8"
            className="console-input mt-1.5 h-8"
          />
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.provision.hardware}</span>
          <input
            name="hardwareId"
            required
            maxLength={64}
            pattern="[A-Za-z0-9_\-]+"
            placeholder="352656100123456"
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.twin.lat}</span>
          <input
            name="latitude"
            type="number"
            step="0.0000001"
            min={-90}
            max={90}
            placeholder="47.2183710"
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.twin.lon}</span>
          <input
            name="longitude"
            type="number"
            step="0.0000001"
            min={-180}
            max={180}
            placeholder="-1.5623410"
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className={TYPE.eyebrow}>{t.provision.notes}</span>
        <span className={`mt-0.5 block ${TYPE.meta}`}>{t.provision.notesHint}</span>
        <textarea
          name="installNotes"
          rows={2}
          maxLength={2000}
          className="console-input mt-1.5 resize-y py-1.5"
        />
      </label>

      {error ? (
        <p
          className="mt-3 font-sans text-[11px]"
          style={{ color: "var(--edl-danger)" }}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className="console-btn-primary">
          {pending ? t.provision.submitting : t.provision.submit}
        </button>
      </div>
    </form>
  );
}
