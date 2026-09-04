"use client";

import { useRef, useState, useTransition } from "react";
import { createContract } from "@/modules/contracts/actions";
import { TYPE } from "@/components/console/ui";
import { BILLING_CYCLE_LABEL } from "@/lib/format";
import { useMessages } from "@/i18n/LocaleProvider";

export function ContractForm({ tenantId }: { tenantId: string }) {
  const t = useMessages();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );

  function onSubmit(formData: FormData) {
    setNotice(null);
    startTransition(async () => {
      const result = await createContract(formData);
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
      if (result.ok) formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="px-4 py-3.5">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className={TYPE.eyebrow}>{t.contractsUi.starts}</span>
          <input name="startsOn" type="date" required className="console-input mt-1.5 h-8" />
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.contractsUi.ends}</span>
          <input name="endsOn" type="date" required className="console-input mt-1.5 h-8" />
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.contractsUi.cycle}</span>
          <select
            name="billingCycle"
            defaultValue="yearly"
            className="console-input mt-1.5 h-8"
          >
            {(Object.keys(BILLING_CYCLE_LABEL) as Array<
              keyof typeof BILLING_CYCLE_LABEL
            >).map((cycle) => (
              <option key={cycle} value={cycle}>
                {t.labels.billing[cycle] ?? cycle}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.contractsUi.amount}</span>
          <input
            name="amount"
            type="number"
            min={0}
            step="0.01"
            required
            placeholder="12000"
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className={TYPE.eyebrow}>{t.contractsUi.notes}</span>
          <input name="notes" maxLength={2000} className="console-input mt-1.5 h-8" />
        </label>
      </div>

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
        {pending ? t.contractsUi.opening : t.contractsUi.open}
      </button>
    </form>
  );
}
