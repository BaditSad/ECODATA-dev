"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { deleteDomain, reinstateDomain, suspendDomain } from "@/modules/domains/actions/lifecycle";
import { Status, TYPE } from "@/components/console/ui";
import { formatDateTime } from "@/lib/format";
import type { ActionResult } from "@/lib/actions";
import { useLocale, useMessages } from "@/i18n/LocaleProvider";
import { fill } from "@/i18n/console";

/**
 * Domain lifecycle controls.
 *
 * Suspension and deletion are presented as different kinds of act, not two
 * buttons in a row. Suspension is reversible and reads as routine collections
 * work; deletion is not, is owner-only, and asks for the slug in writing.
 */
export function DomainLifecycle({
  tenantId,
  slug,
  isActive,
  suspendedAt,
  suspensionReason,
  canWrite,
  isOwner,
}: {
  tenantId: string;
  slug: string;
  isActive: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  canWrite: boolean;
  isOwner: boolean;
}) {
  const t = useMessages();
  const { locale } = useLocale();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");

  function run(action: () => Promise<ActionResult>) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
    });
  }

  return (
    <>
      <div className="border-b border-[var(--edl-border)] px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <Status
            tone={isActive ? "positive" : "critical"}
            label={isActive ? t.lifecycle.active : t.lifecycle.suspended}
          />
          <span className={TYPE.meta}>
            {isActive
              ? t.lifecycle.pinsOk
              : fill(t.lifecycle.suspendedOn, { date: formatDateTime(suspendedAt, locale) })}
          </span>
        </div>

        {!isActive && suspensionReason ? (
          <p className={`mt-2 ${TYPE.body}`}>{suspensionReason}</p>
        ) : null}

        {canWrite ? (
          isActive ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="flex-1 min-w-[18rem]">
                <span className={TYPE.eyebrow}>{t.lifecycle.reason}</span>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  className="console-input mt-1 h-8 w-full"
                />
              </label>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const body = new FormData();
                    body.set("tenantId", tenantId);
                    body.set("reason", reason);
                    const result = await suspendDomain(body);
                    if (result.ok) setReason("");
                    return result;
                  })
                }
                className="console-btn-secondary"
              >
                {t.lifecycle.suspend}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => reinstateDomain(tenantId))}
              className="console-btn-primary mt-3"
            >
              {pending ? t.lifecycle.reinstating : t.lifecycle.reinstate}
            </button>
          )
        ) : null}
      </div>

      {isOwner ? (
        <div className="px-4 py-3.5">
          <p
            className="flex items-center gap-1.5 font-sans text-[10px] font-medium uppercase tracking-[0.11em]"
            style={{ color: "var(--edl-danger)" }}
          >
            <AlertTriangle size={12} aria-hidden />
            {t.lifecycle.deleteTitle}
          </p>

          <p className={`mt-1.5 ${TYPE.body}`}>{t.lifecycle.deleteLead}</p>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-[16rem]">
              <span className={TYPE.eyebrow}>{t.lifecycle.typeSlug}</span>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={slug}
                className="console-input mt-1 h-8 w-full font-mono"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              disabled={pending || confirmation !== slug}
              onClick={() =>
                run(() => {
                  const body = new FormData();
                  body.set("tenantId", tenantId);
                  body.set("confirmation", confirmation);
                  return deleteDomain(body);
                })
              }
              className="console-btn-secondary"
              style={
                confirmation === slug
                  ? {
                      borderColor: "var(--edl-danger-30)",
                      color: "var(--edl-danger)",
                    }
                  : undefined
              }
            >
              {pending ? t.lifecycle.deleting : t.lifecycle.delete}
            </button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p
          className="border-t border-[var(--edl-border)] px-4 py-2.5 font-sans text-[11px]"
          style={{
            color:
              notice.tone === "ok" ? "var(--edl-emerald)" : "var(--edl-danger)",
          }}
          role="status"
        >
          {notice.text}
        </p>
      ) : null}
    </>
  );
}
