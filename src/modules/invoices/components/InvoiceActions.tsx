"use client";

import { useTransition } from "react";
import { markInvoicePaid, voidInvoice } from "@/modules/invoices/actions";
import { useMessages } from "@/i18n/LocaleProvider";

export function InvoiceActions({
  invoiceId,
  canWrite,
  issued,
}: {
  invoiceId: string;
  canWrite: boolean;
  issued: boolean;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();

  if (!canWrite || !issued) return null;

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await markInvoicePaid(invoiceId);
          })
        }
        className="console-btn-quiet"
      >
        {t.invoicesUi.markPaid}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await voidInvoice(invoiceId);
          })
        }
        className="console-btn-quiet"
        style={{ color: "var(--edl-danger)" }}
      >
        {t.invoicesUi.void}
      </button>
    </span>
  );
}
