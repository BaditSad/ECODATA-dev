"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWorkTicket } from "@/modules/tickets/actions";
import { TYPE } from "@/components/console/ui";
import {
  TICKET_DEPARTMENT_LABEL,
  TICKET_PRIORITY_LABEL,
} from "@/lib/format";
import { useMessages } from "@/i18n/LocaleProvider";
import type { AssigneeOption } from "@/lib/data/assignees";
import type {
  TicketDepartment,
  TicketPriority,
  WorkTicketRow,
} from "@/types/database";

export function WorkTicketEditor({
  ticket,
  assignees,
  compact = false,
}: {
  ticket: WorkTicketRow;
  assignees: AssigneeOption[];
  compact?: boolean;
}) {
  const t = useMessages();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );

  function onSubmit(formData: FormData) {
    setNotice(null);
    startTransition(async () => {
      const result = await updateWorkTicket(formData);
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
      if (result.ok) router.refresh();
    });
  }

  return (
    <form action={onSubmit} className={compact ? "" : "px-4 py-3.5"}>
      <input type="hidden" name="ticketId" value={ticket.id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={TYPE.eyebrow}>{t.tickets.department}</span>
          <select
            name="department"
            defaultValue={ticket.department}
            className="console-input mt-1.5 h-8"
          >
            {(Object.keys(TICKET_DEPARTMENT_LABEL) as TicketDepartment[]).map((key) => (
              <option key={key} value={key}>
                {t.labels.department[key] ?? key}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={TYPE.eyebrow}>{t.tickets.priority}</span>
          <select
            name="priority"
            defaultValue={ticket.priority}
            className="console-input mt-1.5 h-8"
          >
            {(Object.keys(TICKET_PRIORITY_LABEL) as TicketPriority[]).map((key) => (
              <option key={key} value={key}>
                {t.labels.priority[key] ?? key}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={TYPE.eyebrow}>{t.tickets.assignTo}</span>
          <select
            name="assignedTo"
            defaultValue={ticket.assigned_to ?? ""}
            className="console-input mt-1.5 h-8"
          >
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
          defaultValue={ticket.title}
          className="console-input mt-1.5 h-8"
        />
      </label>

      <label className="mt-3 block">
        <span className={TYPE.eyebrow}>{t.tickets.description}</span>
        <textarea
          name="description"
          required
          minLength={4}
          rows={6}
          defaultValue={ticket.description}
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
        {pending ? t.tickets.saving : t.tickets.save}
      </button>
    </form>
  );
}
