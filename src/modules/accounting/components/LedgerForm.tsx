"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordLedgerEntry } from "@/modules/accounting/actions";
import { ConsoleModal } from "@/components/console/Modal";
import { TYPE } from "@/components/console/ui";
import { useMessages } from "@/i18n/LocaleProvider";

export function LedgerEntryButton({
  tenants,
}: {
  tenants: { id: string; name: string }[];
}) {
  const t = useMessages();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="console-btn-primary h-8" onClick={() => setOpen(true)}>
        {t.accounting.newEntry}
      </button>
      {open ? (
        <ConsoleModal
          open
          size="lg"
          title={t.accounting.newEntry}
          hint={t.accounting.newHint}
          closeLabel={t.access.close}
          onClose={() => setOpen(false)}
        >
          <LedgerForm
            compact
            tenants={tenants}
            onPosted={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </ConsoleModal>
      ) : null}
    </>
  );
}

export function LedgerForm({
  tenants,
  compact = false,
  onPosted,
}: {
  tenants: { id: string; name: string }[];
  compact?: boolean;
  onPosted?: () => void;
}) {
  const t = useMessages();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );
  const today = new Date().toISOString().slice(0, 10);

  function onSubmit(formData: FormData) {
    setNotice(null);
    startTransition(async () => {
      const result = await recordLedgerEntry(formData);
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
      if (result.ok) {
        formRef.current?.reset();
        onPosted?.();
      }
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className={compact ? "" : "px-4 py-3.5"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={TYPE.eyebrow}>{t.accounting.kind}</span>
          <select name="kind" defaultValue="expense" className="console-input mt-1.5 h-8">
            <option value="expense">{t.accounting.expense}</option>
            <option value="adjustment">{t.accounting.adjustment}</option>
          </select>
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.accounting.amount}</span>
          <input
            name="amount"
            type="number"
            min={0}
            step="0.01"
            required
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.accounting.date}</span>
          <input
            name="occurredOn"
            type="date"
            required
            defaultValue={today}
            className="console-input mt-1.5 h-8"
          />
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.accounting.domain}</span>
          <select name="tenantId" className="console-input mt-1.5 h-8">
            <option value="">{t.accounting.platform}</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className={TYPE.eyebrow}>{t.accounting.memo}</span>
        <input
          name="memo"
          required
          minLength={3}
          maxLength={500}
          className="console-input mt-1.5 h-8"
        />
      </label>

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

      <button type="submit" disabled={pending} className="console-btn-primary mt-3">
        {pending ? t.accounting.posting : t.accounting.post}
      </button>
    </form>
  );
}
