"use client";

import { useRef, useState, useTransition } from "react";
import { issueInvoice } from "@/modules/invoices/actions";
import { TYPE } from "@/components/console/ui";
import { formatDate } from "@/lib/format";
import { useLocale, useMessages } from "@/i18n/LocaleProvider";

export function InvoiceForm({
  contracts,
}: {
  contracts: { id: string; starts_on: string; ends_on: string; status: string }[];
}) {
  const t = useMessages();
  const { locale } = useLocale();
  const rangeSep = locale === "fr" ? " au " : " to ";
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );

  const defaultDue = new Date(Date.now() + 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const billable = contracts.filter((contract) => contract.status !== "cancelled");
  const defaultContract =
    billable.find((contract) => contract.status === "active") ?? billable[0];

  if (billable.length === 0) {
    return (
      <p className={`px-4 py-3.5 ${TYPE.meta}`}>{t.invoicesUi.needContract}</p>
    );
  }

  function onSubmit(formData: FormData) {
    setNotice(null);
    startTransition(async () => {
      const result = await issueInvoice(formData);
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
      if (result.ok) formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="px-4 py-3.5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={TYPE.eyebrow}>{t.invoicesUi.contract}</span>
          <select
            name="contractId"
            required
            defaultValue={defaultContract?.id}
            className="console-input mt-1.5 h-8"
          >
            {billable.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {formatDate(contract.starts_on, locale)}
                {rangeSep}
                {formatDate(contract.ends_on, locale)}
                {contract.status === "active"
                  ? ""
                  : ` · ${t.labels.contract[contract.status] ?? contract.status}`}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.invoicesUi.amount}</span>
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
          <span className={TYPE.eyebrow}>{t.invoicesUi.tax}</span>
          <input
            name="tax"
            type="number"
            min={0}
            step="0.01"
            defaultValue="0"
            className="console-input mt-1.5 h-8 font-mono"
          />
        </label>

        <label className="block">
          <span className={TYPE.eyebrow}>{t.invoicesUi.due}</span>
          <input
            name="dueOn"
            type="date"
            required
            defaultValue={defaultDue}
            className="console-input mt-1.5 h-8"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className={TYPE.eyebrow}>{t.invoicesUi.memo}</span>
        <input name="notes" maxLength={500} className="console-input mt-1.5 h-8" />
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
        {pending ? t.invoicesUi.issuing : t.invoicesUi.issue}
      </button>
    </form>
  );
}
