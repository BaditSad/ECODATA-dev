"use client";

import { useRef, useState, useTransition } from "react";
import { reportHotelIncident } from "@/modules/incidents/actions";
import { TYPE } from "@/components/console/ui";
import { TICKET_PRIORITY_LABEL } from "@/lib/format";
import type { TicketPriority } from "@/types/database";

export function ReportIncidentForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );

  function onSubmit(formData: FormData) {
    setNotice(null);
    startTransition(async () => {
      const result = await reportHotelIncident(formData);
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
      if (result.ok) formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="px-4 py-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={TYPE.eyebrow}>Title</span>
          <input name="title" required minLength={3} maxLength={200} className="console-input mt-1.5 h-8" />
        </label>
        <label className="block">
          <span className={TYPE.eyebrow}>Priority</span>
          <select name="priority" defaultValue="normal" className="console-input mt-1.5 h-8">
            {(Object.keys(TICKET_PRIORITY_LABEL) as TicketPriority[]).map((key) => (
              <option key={key} value={key}>
                {TICKET_PRIORITY_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block">
        <span className={TYPE.eyebrow}>Description</span>
        <textarea
          name="description"
          required
          minLength={4}
          rows={4}
          className="console-input mt-1.5 resize-y py-1.5"
        />
      </label>
      {notice ? (
        <p
          className="mt-3 font-sans text-[11px]"
          style={{
            color: notice.tone === "ok" ? "var(--edl-emerald)" : "var(--edl-danger)",
          }}
        >
          {notice.text}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="console-btn-primary mt-3">
        {pending ? "Sending…" : "Report incident"}
      </button>
    </form>
  );
}
