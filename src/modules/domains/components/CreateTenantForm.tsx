"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import {
  createTenant,
  type OnboardedTenantPayload,
} from "@/modules/domains/actions/onboarding";
import { TYPE } from "@/components/console/ui";
import { slugify } from "@/lib/slug";
import { useMessages } from "@/i18n/LocaleProvider";
import { fill } from "@/i18n/console";

/**
 * Resort onboarding form.
 *
 * Onboarding hands back three secrets at once — the lobby code, the first
 * guest PIN and the manager's password — and only the password is
 * unrecoverable. So the result takes over the whole panel and has to be
 * dismissed deliberately, rather than appearing as a toast that can be
 * scrolled past.
 */
export function CreateTenantForm() {
  const t = useMessages();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState<OnboardedTenantPayload | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  // An untouched slug field tracks the name; once edited it stops, so an
  // operator never has a deliberate slug overwritten by a later typo fix.
  const previewSlug = useMemo(() => slug || slugify(name), [slug, name]);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createTenant(formData);
      if (result.ok && result.data) {
        setOnboarded(result.data);
        formRef.current?.reset();
        setName("");
        setSlug("");
      } else {
        setError(result.message);
      }
    });
  }

  if (onboarded) {
    return (
      <div className="px-4 py-3.5">
        <div
          className="rounded-md border p-3"
          style={{
            borderColor: "var(--edl-gold-40)",
            background: "var(--edl-gold-10)",
          }}
        >
          <p className="font-sans text-[12px] font-medium text-[var(--edl-text)]">
            {fill(t.onboardForm.live, { name: onboarded.name })}
          </p>
          <p className={`mt-1 ${TYPE.meta}`}>{t.onboardForm.secretsLead}</p>

          <div className="mt-3 flex flex-col gap-2">
            <SecretField label={t.onboardForm.lobbyCode} value={onboarded.lobbyCode} />
            {onboarded.guestPin ? (
              <SecretField label={t.onboardForm.firstPin} value={onboarded.guestPin} />
            ) : null}
            {onboarded.manager ? (
              <>
                <SecretField label={t.onboardForm.manager} value={onboarded.manager.email} />
                <SecretField
                  label={t.onboardForm.tempPassword}
                  value={onboarded.manager.temporaryPassword}
                />
              </>
            ) : null}
          </div>

          {onboarded.warning ? (
            <p
              className="mt-3 font-sans text-[11px] leading-relaxed"
              style={{ color: "var(--edl-danger)" }}
              role="alert"
            >
              {onboarded.warning}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/domains/${onboarded.tenantId}`}
              className="console-btn-primary"
            >
              {fill(t.onboardForm.open, { slug: onboarded.slug })}
            </Link>
            <button
              type="button"
              onClick={() => setOnboarded(null)}
              className="console-btn-secondary"
            >
              {t.onboardForm.another}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={onSubmit} className="px-4 py-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={TYPE.eyebrow}>{t.onboardForm.resortName}</span>
          <input
            name="name"
            required
            minLength={2}
            maxLength={255}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Domaine Lagon Vert"
            className="console-input mt-1.5 h-8"
          />
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.onboardForm.slug}</span>
          <input
            name="slug"
            maxLength={255}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder={slugify(name) || "domaine-lagon-vert"}
            className="console-input mt-1.5 h-8 font-mono"
          />
          <span className={`mt-1 block ${TYPE.meta}`}>
            {previewSlug
              ? fill(t.onboardForm.slugSet, { slug: previewSlug })
              : t.onboardForm.slugBlank}
          </span>
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.onboardForm.country}</span>
          <input
            name="countryCode"
            maxLength={2}
            pattern="[A-Za-z]{2}"
            placeholder="CR"
            className="console-input mt-1.5 h-8 font-mono uppercase"
          />
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.onboardForm.timezone}</span>
          <input
            name="timezone"
            required
            maxLength={64}
            defaultValue="UTC"
            placeholder="America/Costa_Rica"
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.onboardForm.subscription}</span>
          <select
            name="subscriptionStatus"
            defaultValue="trial"
            className="console-input mt-1.5 h-8"
          >
            <option value="trial">{t.labels.subscription.trial}</option>
            <option value="active">{t.labels.subscription.active}</option>
          </select>
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.onboardForm.quota}</span>
          <input
            name="sensorQuota"
            type="number"
            min={0}
            max={512}
            defaultValue={7}
            className="console-input mt-1.5 h-8 font-mono"
          />
          <span className={`mt-1 block ${TYPE.meta}`}>{t.onboardForm.quotaHint}</span>
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.onboardForm.lat}</span>
          <input
            name="latitude"
            type="number"
            step="0.0000001"
            min={-90}
            max={90}
            placeholder="10.4520000"
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.onboardForm.lon}</span>
          <input
            name="longitude"
            type="number"
            step="0.0000001"
            min={-180}
            max={180}
            placeholder="-85.2340000"
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className={TYPE.eyebrow}>{t.onboardForm.lobbyCode}</span>
        <span className={`mt-0.5 block ${TYPE.meta}`}>{t.onboardForm.lobbyHint}</span>
        <input
          name="lobbyCode"
          maxLength={32}
          placeholder="LAGON-KTQFHW"
          className="console-input mt-1.5 h-8 font-mono uppercase"
        />
      </label>

      <fieldset className="mt-4 border-t border-[var(--edl-border)] pt-3">
        <legend className="sr-only">{t.onboardForm.managerLegend}</legend>
        <p className={TYPE.eyebrow}>{t.onboardForm.managerLegend}</p>
        <p className={`mt-1 ${TYPE.meta}`}>{t.onboardForm.managerHint}</p>

        <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={TYPE.eyebrow}>{t.onboardForm.workEmail}</span>
            <input
              name="managerEmail"
              type="email"
              maxLength={320}
              placeholder="gm@lagonvert.com"
              className="console-input mt-1.5 h-8"
            />
          </label>

          <label className="block">
            <span className={TYPE.eyebrow}>{t.onboardForm.fullName}</span>
            <input
              name="managerName"
              maxLength={255}
              placeholder="Camille Roy"
              className="console-input mt-1.5 h-8"
            />
          </label>
        </div>
      </fieldset>

      {error ? (
        <p
          className="mt-3 font-sans text-[11px]"
          style={{ color: "var(--edl-danger)" }}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={pending} className="console-btn-primary">
          {pending ? t.onboardForm.submitting : t.onboardForm.submit}
        </button>
        <span className={TYPE.meta}>{t.onboardForm.submitHint}</span>
      </div>
    </form>
  );
}

function SecretField({ label, value }: { label: string; value: string }) {
  const t = useMessages();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be denied; the value stays selectable on screen.
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`w-[10rem] shrink-0 ${TYPE.eyebrow}`}>{label}</span>
      <code className="min-w-0 flex-1 overflow-x-auto rounded border border-[var(--edl-border-strong)] bg-[var(--edl-bg)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--edl-text)]">
        {value}
      </code>
      <button type="button" onClick={copy} className="console-btn-secondary">
        {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
        {copied ? t.copied : t.copy}
      </button>
    </div>
  );
}
