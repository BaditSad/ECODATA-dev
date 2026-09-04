"use client";

import { useRef, useState, useTransition } from "react";
import { createErpAccount } from "@/modules/access/actions";
import { TYPE } from "@/components/console/ui";
import { useMessages } from "@/i18n/LocaleProvider";
import { Check, Copy } from "lucide-react";

export function CreateAccountForm({
  compact = false,
  onIssuedChange,
  onStored,
}: {
  compact?: boolean;
  onIssuedChange?: (issued: boolean) => void;
  onStored?: () => void;
}) {
  const t = useMessages();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; temporaryPassword: string } | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createErpAccount(formData);
      if (result.ok && result.data) {
        setIssued({
          email: result.data.email,
          temporaryPassword: result.data.temporaryPassword,
        });
        setCopied(false);
        formRef.current?.reset();
        onIssuedChange?.(true);
      } else {
        setError(result.message);
      }
    });
  }

  if (issued) {
    return (
      <div className={compact ? "" : "px-4 py-3.5"}>
        <div
          className="rounded-md border p-3"
          style={{
            borderColor: "var(--edl-gold-40)",
            background: "var(--edl-gold-10)",
          }}
        >
          <p className="font-sans text-[12px] font-medium text-[var(--edl-text)]">
            {issued.email}
          </p>
          <p className={`mt-1 ${TYPE.meta}`}>{t.access.issuedLead}</p>
          <div className="mt-2.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded border border-[var(--edl-border-strong)] bg-[var(--edl-bg)] px-2.5 py-2 font-mono text-[11px] text-[var(--edl-text)]">
              {issued.temporaryPassword}
            </code>
            <button
              type="button"
              className="console-btn-secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(issued.temporaryPassword);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
              {copied ? t.access.copied : t.access.copy}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setIssued(null);
              onIssuedChange?.(false);
              onStored?.();
            }}
            className="console-btn-primary mt-3"
          >
            {t.access.storedPassword}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={onSubmit} className={compact ? "" : "px-4 py-3.5"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={TYPE.eyebrow}>{t.access.workEmail}</span>
          <input
            name="email"
            type="email"
            required
            maxLength={320}
            className="console-input mt-1.5 h-8"
          />
        </label>
        <label className="block">
          <span className={TYPE.eyebrow}>{t.access.fullName}</span>
          <input name="fullName" maxLength={255} className="console-input mt-1.5 h-8" />
        </label>
      </div>
      {error ? (
        <p className="mt-3 font-sans text-[11px]" style={{ color: "var(--edl-danger)" }} role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="console-btn-primary mt-3">
        {pending ? t.access.creating : t.access.create}
      </button>
    </form>
  );
}
