"use client";

import type { TicketDepartment } from "@/types/database";
import { TICKET_DEPARTMENT_COLOR } from "@/lib/format";
import { useMessages } from "@/i18n/LocaleProvider";

export function DepartmentBadge({
  department,
}: {
  department: TicketDepartment;
}) {
  const t = useMessages();
  const color = TICKET_DEPARTMENT_COLOR[department];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-sans text-[11px] font-medium"
      style={{ color: color.fg, background: color.soft }}
    >
      <span
        className="h-[6px] w-[6px] shrink-0 rounded-full"
        style={{ background: color.fg }}
        aria-hidden
      />
      {t.labels.department[department] ?? department}
    </span>
  );
}
