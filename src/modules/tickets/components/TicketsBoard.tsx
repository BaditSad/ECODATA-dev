"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveWorkTicket,
  deleteWorkTicket,
  setTicketStatus,
} from "@/modules/tickets/actions";
import type { WorkTicketListItem } from "@/modules/tickets/data";
import type { AssigneeOption } from "@/lib/data/assignees";
import { WorkTicketForm } from "@/modules/tickets/components/WorkTicketForm";
import { WorkTicketEditor } from "@/modules/tickets/components/WorkTicketEditor";
import { ConsoleModal } from "@/components/console/Modal";
import { DepartmentBadge } from "@/components/console/DepartmentBadge";
import {
  Card,
  CardHeader,
  Cell,
  EmptyState,
  Row,
  Status,
  Table,
  TYPE,
} from "@/components/console/ui";
import {
  formatDateTime,
  TICKET_BOARD_COLUMNS,
  TICKET_COLUMN_COLOR,
  TICKET_DEPARTMENT_LABEL,
  ticketPriorityTone,
} from "@/lib/format";
import { dateLocale } from "@/i18n/types";
import { useLocale, useMessages } from "@/i18n/LocaleProvider";
import {
  archiveMonthOf,
  currentYearMonth,
  formatYearMonth,
  shiftYearMonth,
} from "@/modules/tickets/months";
import type {
  TicketBoardColumn,
  TicketDepartment,
  TicketStatus,
} from "@/types/database";

const DEPARTMENTS = Object.keys(TICKET_DEPARTMENT_LABEL) as TicketDepartment[];

type DepartmentFilter = "all" | TicketDepartment;
type IncidentFilter = "all" | "incident" | "not";

export function TicketsBoard({
  tickets,
  assignees,
  canWrite,
  initiallyOpenId,
}: {
  tickets: WorkTicketListItem[];
  assignees: AssigneeOption[];
  canWrite: boolean;
  initiallyOpenId?: string;
}) {
  const t = useMessages();
  const { locale } = useLocale();
  const router = useRouter();
  const initial = tickets.find((ticket) => ticket.id === initiallyOpenId) ?? null;

  const [department, setDepartment] = useState<DepartmentFilter>("all");
  const [incident, setIncident] = useState<IncidentFilter>("all");
  const [assigneeId, setAssigneeId] = useState("all");
  const [archivesOpen, setArchivesOpen] = useState(initial?.status === "archived");
  const [month, setMonth] = useState(
    initial?.status === "archived" ? archiveMonthOf(initial) : currentYearMonth()
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initial?.id ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, TicketStatus>>({});
  const [dropTarget, setDropTarget] = useState<TicketBoardColumn | "archived" | null>(
    null
  );
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );
  const draggingId = useRef<string | null>(null);
  const didDrag = useRef(false);

  const resolved = useMemo(
    () =>
      tickets.map((ticket) => ({
        ...ticket,
        status: overrides[ticket.id] ?? ticket.status,
      })),
    [tickets, overrides]
  );

  const boardTickets = useMemo(() => {
    return resolved.filter((ticket) => {
      if (ticket.status === "archived") return false;
      if (department !== "all" && ticket.department !== department) return false;
      if (incident === "incident" && !ticket.source_incident_id) return false;
      if (incident === "not" && ticket.source_incident_id) return false;
      if (assigneeId === "unassigned" && ticket.assigned_to) return false;
      if (
        assigneeId !== "all" &&
        assigneeId !== "unassigned" &&
        ticket.assigned_to !== assigneeId
      ) {
        return false;
      }
      return true;
    });
  }, [resolved, department, incident, assigneeId]);

  const archived = useMemo(
    () =>
      resolved
        .filter((ticket) => ticket.status === "archived")
        .sort((a, b) => {
          const left = a.archived_at ?? a.updated_at;
          const right = b.archived_at ?? b.updated_at;
          return new Date(right).getTime() - new Date(left).getTime();
        }),
    [resolved]
  );

  const archivedThisMonth = archived.filter(
    (ticket) => archiveMonthOf(ticket) === month
  );

  const oldestMonth = archived.length > 0 ? archiveMonthOf(archived[archived.length - 1]!) : month;
  const newestMonth = currentYearMonth();
  const selected = resolved.find((ticket) => ticket.id === selectedId) ?? null;

  const assigneeOptions = useMemo(() => {
    const byId = new Map(assignees.map((account) => [account.id, account]));
    for (const ticket of tickets) {
      if (ticket.assigned_to && !byId.has(ticket.assigned_to)) {
        byId.set(ticket.assigned_to, {
          id: ticket.assigned_to,
          email: ticket.assignee_email ?? "",
          fullName: ticket.assignee_name,
        });
      }
    }
    return [...byId.values()];
  }, [assignees, tickets]);

  const columnLabels: Record<TicketBoardColumn, string> = {
    draft: t.tickets.columnDraft,
    waiting: t.tickets.columnWaiting,
    in_progress: t.tickets.columnProgress,
    done: t.tickets.columnDone,
  };

  function run(
    action: () => Promise<{ ok: boolean; message: string }>,
    after?: () => void
  ) {
    startTransition(async () => {
      const result = await action();
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
      if (result.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  function move(ticketId: string, next: TicketStatus) {
    if (!canWrite) return;
    const current = resolved.find((ticket) => ticket.id === ticketId);
    if (!current || current.status === next) return;
    setOverrides((current) => ({ ...current, [ticketId]: next }));
    startTransition(async () => {
      const result = await setTicketStatus(ticketId, next);
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
      setOverrides((current) => {
        const copy = { ...current };
        delete copy[ticketId];
        return copy;
      });
      if (result.ok) router.refresh();
    });
  }

  function onDragStart(ticketId: string) {
    draggingId.current = ticketId;
    didDrag.current = true;
  }

  function onDragEnd() {
    draggingId.current = null;
    setDropTarget(null);
    window.setTimeout(() => {
      didDrag.current = false;
    }, 50);
  }

  function onDropColumn(event: { preventDefault: () => void; dataTransfer: DataTransfer }, column: TicketBoardColumn) {
    event.preventDefault();
    const ticketId = event.dataTransfer.getData("text/plain") || draggingId.current;
    setDropTarget(null);
    draggingId.current = null;
    if (ticketId) move(ticketId, column);
  }

  function onDropArchive(event: { preventDefault: () => void; dataTransfer: DataTransfer }) {
    event.preventDefault();
    const ticketId = event.dataTransfer.getData("text/plain") || draggingId.current;
    setDropTarget(null);
    draggingId.current = null;
    if (ticketId) move(ticketId, "archived");
  }

  function openTicket(ticketId: string) {
    if (didDrag.current) return;
    setConfirmDelete(false);
    setNotice(null);
    setSelectedId(ticketId);
  }

  return (
    <div className="flex flex-col gap-4">
      {notice ? (
        <p
          className="font-sans text-[11px]"
          style={{
            color: notice.tone === "ok" ? "var(--edl-emerald)" : "var(--edl-danger)",
          }}
          role="status"
        >
          {notice.text}
        </p>
      ) : null}

      {archivesOpen ? (
        <div>
          <button
            type="button"
            className="console-btn-secondary h-8"
            onClick={() => setArchivesOpen(false)}
          >
            {t.tickets.back}
          </button>
        </div>
      ) : (
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          {canWrite ? (
            <button
              type="button"
              className="console-btn-primary h-8"
              onClick={() => setCreateOpen(true)}
            >
              {t.tickets.newTicket}
            </button>
          ) : null}
          <label className="block min-w-[9rem]">
            <span className={TYPE.eyebrow}>{t.tickets.department}</span>
            <select
              value={department}
              onChange={(event) =>
                setDepartment(event.target.value as DepartmentFilter)
              }
              className="console-input mt-1.5 h-8"
            >
              <option value="all">{t.tickets.filterAll}</option>
              {DEPARTMENTS.map((key) => (
                <option key={key} value={key}>
                  {t.labels.department[key] ?? key}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[9rem]">
            <span className={TYPE.eyebrow}>{t.tickets.incidentBadge}</span>
            <select
              value={incident}
              onChange={(event) =>
                setIncident(event.target.value as IncidentFilter)
              }
              className="console-input mt-1.5 h-8"
            >
              <option value="all">{t.tickets.filterAll}</option>
              <option value="incident">{t.tickets.filterIncident}</option>
              <option value="not">{t.tickets.filterNotIncident}</option>
            </select>
          </label>
          <label className="block min-w-[10rem]">
            <span className={TYPE.eyebrow}>{t.tickets.filterAssignee}</span>
            <select
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              className="console-input mt-1.5 h-8"
            >
              <option value="all">{t.tickets.filterAll}</option>
              <option value="unassigned">{t.tickets.unassigned}</option>
              {assigneeOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.fullName?.trim() || account.email}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="console-btn-secondary ml-auto h-8"
          onClick={() => {
            const withData = archived[0] ? archiveMonthOf(archived[0]) : currentYearMonth();
            setMonth(withData);
            setArchivesOpen(true);
          }}
          onDragOver={(event) => {
            if (!canWrite || !draggingId.current) return;
            event.preventDefault();
            setDropTarget("archived");
          }}
          onDragLeave={() => {
            if (dropTarget === "archived") setDropTarget(null);
          }}
          onDrop={(event) => {
            onDropArchive(event);
          }}
          style={
            dropTarget === "archived"
              ? {
                  borderColor: "var(--edl-emerald-30)",
                  color: "var(--edl-emerald)",
                  background: "var(--edl-soft)",
                }
              : undefined
          }
        >
          {dropTarget === "archived" ? t.tickets.dropArchive : t.tickets.archives}
        </button>
      </div>
      )}

      {!archivesOpen ? (
        <div className="grid gap-3 lg:grid-cols-4">
              {TICKET_BOARD_COLUMNS.map((column) => {
                const color = TICKET_COLUMN_COLOR[column];
                const items = boardTickets.filter((ticket) => ticket.status === column);
                const over = dropTarget === column;
                return (
                  <Card key={column}>
                    <div
                      className="flex min-h-[22rem] flex-col"
                      onDragOver={(event) => {
                        if (!canWrite || !draggingId.current) return;
                        event.preventDefault();
                        setDropTarget(column);
                      }}
                      onDragLeave={() => {
                        if (dropTarget === column) setDropTarget(null);
                      }}
                      onDrop={(event) => {
                        onDropColumn(event, column);
                      }}
                      style={
                        over
                          ? { outline: `1px solid ${color.line}`, background: color.soft }
                          : undefined
                      }
                    >
                      <div
                        className="flex items-center justify-between gap-2 border-b px-4 py-3"
                        style={{ borderColor: color.line, background: color.soft }}
                      >
                        <h2 className={TYPE.h2} style={{ color: color.fg }}>
                          {columnLabels[column]}
                        </h2>
                        <span className={TYPE.meta} style={{ color: color.fg }}>
                          {items.length}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-2">
                        {items.length === 0 ? (
                          <p className={`px-2 py-6 text-center ${TYPE.meta}`}>
                            {t.tickets.emptyColumn}
                          </p>
                        ) : (
                          items.map((ticket) => (
                            <TicketCard
                              key={ticket.id}
                              ticket={ticket}
                              canDrag={canWrite}
                              incidentLabel={t.tickets.incidentBadge}
                              unassigned={t.tickets.unassigned}
                              onOpen={() => openTicket(ticket.id)}
                              onDragStart={() => onDragStart(ticket.id)}
                              onDragEnd={onDragEnd}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
      ) : (
        <Card>
          <CardHeader
            title={formatYearMonth(month, dateLocale(locale))}
            hint={`${archivedThisMonth.length} · ${t.tickets.archives}`}
          >
            <button
              type="button"
              className="console-btn-quiet"
              disabled={month <= oldestMonth}
              aria-label={t.tickets.monthPrev}
              onClick={() => setMonth(shiftYearMonth(month, -1))}
            >
              ‹
            </button>
            <button
              type="button"
              className="console-btn-quiet"
              disabled={month >= newestMonth}
              aria-label={t.tickets.monthNext}
              onClick={() => setMonth(shiftYearMonth(month, 1))}
            >
              ›
            </button>
          </CardHeader>
          {archivedThisMonth.length === 0 ? (
            <EmptyState
              title={t.tickets.emptyArchives}
              detail={t.tickets.emptyArchivesDetail}
            />
          ) : (
            <Table
              head={[
                t.tickets.title,
                t.tickets.department,
                t.tickets.filterAssignee,
                t.tickets.archivedOn,
              ]}
            >
              {archivedThisMonth.map((ticket) => (
                <Row key={ticket.id}>
                  <Cell>
                    <button
                      type="button"
                      onClick={() => openTicket(ticket.id)}
                      className="text-left font-medium text-[var(--edl-text)] underline-offset-2 hover:underline"
                    >
                      {ticket.title}
                    </button>
                    <p className={`mt-0.5 line-clamp-1 ${TYPE.meta}`}>
                      {ticket.description}
                    </p>
                  </Cell>
                  <Cell>
                    <DepartmentBadge department={ticket.department} />
                  </Cell>
                  <Cell>
                    {ticket.assignee_name ?? ticket.assignee_email ?? (
                      <span className={TYPE.meta}>{t.tickets.unassigned}</span>
                    )}
                  </Cell>
                  <Cell>
                    {formatDateTime(ticket.archived_at ?? ticket.updated_at, locale)}
                  </Cell>
                </Row>
              ))}
            </Table>
          )}
        </Card>
      )}

      {createOpen ? (
        <ConsoleModal
          open
          size="lg"
          title={t.tickets.newTicket}
          hint={t.tickets.newHint}
          closeLabel={t.access.close}
          onClose={() => setCreateOpen(false)}
        >
          <WorkTicketForm
            compact
            assignees={assignees}
            onCreated={() => {
              setCreateOpen(false);
              setNotice({ tone: "ok", text: t.tickets.created });
            }}
          />
        </ConsoleModal>
      ) : null}

      {selected ? (
        <ConsoleModal
          open
          size="lg"
          title={selected.title}
          hint={`${t.labels.department[selected.department] ?? selected.department} · ${formatDateTime(selected.created_at, locale)}`}
          closeLabel={t.access.close}
          onClose={() => {
            if (pending) return;
            setConfirmDelete(false);
            setSelectedId(null);
          }}
          footer={
            canWrite ? (
              selected.status === "archived" ? (
                confirmDelete ? (
                  <>
                    <button
                      type="button"
                      className="console-btn-secondary"
                      disabled={pending}
                      onClick={() => setConfirmDelete(false)}
                    >
                      {t.access.cancel}
                    </button>
                    <button
                      type="button"
                      className="console-btn-primary"
                      disabled={pending}
                      onClick={() =>
                        run(() => deleteWorkTicket(selected.id), () => {
                          setConfirmDelete(false);
                          setSelectedId(null);
                        })
                      }
                      style={{ background: "var(--edl-danger)", color: "#0b0f17" }}
                    >
                      {pending ? t.tickets.deleting : t.tickets.confirmDelete}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="console-btn-quiet"
                    disabled={pending}
                    style={{ color: "var(--edl-danger)" }}
                    onClick={() => setConfirmDelete(true)}
                  >
                    {t.tickets.delete}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  className="console-btn-secondary"
                  disabled={pending}
                  onClick={() =>
                    run(() => archiveWorkTicket(selected.id), () => setSelectedId(null))
                  }
                >
                  {t.tickets.archive}
                </button>
              )
            ) : null
          }
        >
          {canWrite && selected.status !== "archived" ? (
            <WorkTicketEditor compact ticket={selected} assignees={assignees} />
          ) : (
            <div className="space-y-3">
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className={TYPE.eyebrow}>{t.tickets.department}</dt>
                  <dd className="mt-1">
                    <DepartmentBadge department={selected.department} />
                  </dd>
                </div>
                <div>
                  <dt className={TYPE.eyebrow}>{t.tickets.priority}</dt>
                  <dd className="mt-1">
                    <Status
                      tone={ticketPriorityTone(selected.priority)}
                      label={t.labels.priority[selected.priority] ?? selected.priority}
                    />
                  </dd>
                </div>
                <div>
                  <dt className={TYPE.eyebrow}>{t.tickets.filterAssignee}</dt>
                  <dd className="mt-1 font-sans text-[12px] text-[var(--edl-text)]">
                    {selected.assignee_name ??
                      selected.assignee_email ??
                      t.tickets.unassigned}
                  </dd>
                </div>
                <div>
                  <dt className={TYPE.eyebrow}>{t.tickets.opened}</dt>
                  <dd className="mt-1 font-sans text-[12px] text-[var(--edl-text-soft)]">
                    {formatDateTime(selected.created_at, locale)}
                  </dd>
                </div>
              </dl>
              {selected.source_incident_id ? (
                <p className={TYPE.meta}>{t.tickets.incidentBadge}</p>
              ) : null}
              <p className={`whitespace-pre-wrap ${TYPE.body}`}>{selected.description}</p>
            </div>
          )}
        </ConsoleModal>
      ) : null}
    </div>
  );
}

function TicketCard({
  ticket,
  canDrag,
  incidentLabel,
  unassigned,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  ticket: WorkTicketListItem;
  canDrag: boolean;
  incidentLabel: string;
  unassigned: string;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useMessages();
  return (
    <article
      draggable={canDrag}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", ticket.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="rounded-md border border-[var(--edl-border)] bg-[var(--edl-bg)] px-3 py-2.5 text-left"
      style={{ cursor: canDrag ? "grab" : "pointer" }}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <p className="font-sans text-[12px] font-medium text-[var(--edl-text)]">
          {ticket.title}
        </p>
        <p className={`mt-0.5 line-clamp-2 ${TYPE.meta}`}>{ticket.description}</p>
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <DepartmentBadge department={ticket.department} />
        <Status
          tone={ticketPriorityTone(ticket.priority)}
          label={t.labels.priority[ticket.priority] ?? ticket.priority}
        />
        {ticket.source_incident_id ? (
          <span
            className="rounded-md px-1.5 py-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.08em]"
            style={{ color: "var(--edl-gold)", background: "var(--edl-gold-10)" }}
          >
            {incidentLabel}
          </span>
        ) : null}
      </div>
      <p className={`mt-1.5 ${TYPE.meta}`}>
        {ticket.assignee_name ?? ticket.assignee_email ?? unassigned}
      </p>
    </article>
  );
}
