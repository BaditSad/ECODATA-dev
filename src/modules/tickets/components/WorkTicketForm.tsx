"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkTicket } from "@/modules/tickets/actions";
import { TYPE } from "@/components/console/ui";
import {
  TICKET_DEPARTMENT_LABEL,
  TICKET_PRIORITY_LABEL,
} from "@/lib/format";
import { useMessages } from "@/i18n/LocaleProvider";
import type { AssigneeOption } from "@/lib/data/assignees";
import type { TicketDepartment, TicketPriority } from "@/types/database";

export function WorkTicketForm({
  assignees,
  defaults,
  compact = false,
  onCreated,
}: {
  assignees: AssigneeOption[];
  defaults?: {
    title?: string;
    description?: string;
    priority?: TicketPriority;
    sourceIncidentId?: string;
  };
  compact?: boolean;
  onCreated?: (ticketId: string) => void;
}) {
  const t = useMessages();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createWorkTicket(formData);
      if (result.ok && result.data) {
        formRef.current?.reset();
        if (onCreated) onCreated(result.data.ticketId);
        else router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className={compact ? "" : "px-4 py-3.5"}>
      {defaults?.sourceIncidentId ? (
        <input type="hidden" name="sourceIncidentId" value={defaults.sourceIncidentId} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={TYPE.eyebrow}>{t.tickets.department}</span>
          <select name="department" required defaultValue="it" className="console-input mt-1.5 h-8">
            {(Object.keys(TICKET_DEPARTMENT_LABEL) as TicketDepartment[]).map((key) => (
              <option key={key} value={key}>
                {t.labels.department[key] ?? key}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={TYPE.eyebrow}>{t.tickets.priority}</span>
          <select name="priority" defaultValue={defaults?.priority ?? "normal"} className="console-input mt-1.5 h-8">
            {(Object.keys(TICKET_PRIORITY_LABEL) as TicketPriority[]).map((key) => (
              <option key={key} value={key}>
                {t.labels.priority[key] ?? key}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={TYPE.eyebrow}>{t.tickets.assignTo}</span>
          <select name="assignedTo" defaultValue="" className="console-input mt-1.5 h-8">
            <option value="">{t.tickets.unassigned}</option>
            {assignees.map((account) => (
              <option key={account.id} value={account.id}>
                {account.fullName?.trim() || account.email}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className={TYPE.eyebrow}>{t.tickets.title}</span>
        <input
          name="title"
          required
          minLength={3}
          maxLength={200}
          defaultValue={defaults?.title}
          className="console-input mt-1.5 h-8"
        />
      </label>

      <label className="mt-3 block">
        <span className={TYPE.eyebrow}>{t.tickets.description}</span>
        <textarea
          name="description"
          required
          minLength={4}
          rows={4}
          defaultValue={defaults?.description}
          className="console-input mt-1.5 resize-y py-1.5"
        />
      </label>

      {error ? (
        <p className="mt-3 font-sans text-[11px]" style={{ color: "var(--edl-danger)" }} role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="console-btn-primary mt-3">
        {pending ? t.tickets.creating : t.tickets.create}
      </button>
    </form>
  );
}
