"use client";

import { useState, useTransition } from "react";
import { cancelContract } from "@/modules/contracts/actions";
import { useMessages } from "@/i18n/LocaleProvider";

export function CancelContractButton({ contractId }: { contractId: string }) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await cancelContract(contractId);
            if (!result.ok) setError(result.message);
          });
        }}
        className="console-btn-quiet"
        style={{ color: "var(--edl-danger)" }}
      >
        {pending ? t.contractsUi.cancelling : t.contractsUi.cancel}
      </button>
      {error ? (
        <span className="font-sans text-[11px]" style={{ color: "var(--edl-danger)" }}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
