"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveIncident,
  deleteIncident,
  setIncidentStatus,
} from "@/modules/incidents/actions";
import type { IncidentListItem } from "@/modules/incidents/data";
import type { AssigneeOption } from "@/lib/data/assignees";
import { WorkTicketForm } from "@/modules/tickets/components/WorkTicketForm";
import { ConsoleModal } from "@/components/console/Modal";
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
  incidentStatusTone,
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

type SortKey = "date_desc" | "date_asc" | "title_asc" | "title_desc";

export function IncidentsBoard({
  incidents,
  canWrite,
  canCreateTicket,
  assignees,
  initiallyOpenId,
}: {
  incidents: IncidentListItem[];
  canWrite: boolean;
  canCreateTicket: boolean;
  assignees: AssigneeOption[];
  initiallyOpenId?: string;
}) {
  const t = useMessages();
  const { locale } = useLocale();
  const router = useRouter();
  const initial = incidents.find((incident) => incident.id === initiallyOpenId) ?? null;

  const [sort, setSort] = useState<SortKey>("date_desc");
  const [archivesOpen, setArchivesOpen] = useState(initial?.status === "archived");
  const [month, setMonth] = useState(
    initial?.status === "archived" ? archiveMonthOf(initial) : currentYearMonth()
  );
  const [selectedId, setSelectedId] = useState<string | null>(initial?.id ?? null);
  const [ticketForId, setTicketForId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );

  const active = useMemo(
    () => incidents.filter((incident) => incident.status !== "archived"),
    [incidents]
  );

  const archived = useMemo(
    () =>
      incidents
        .filter((incident) => incident.status === "archived")
        .sort((a, b) => {
          const left = a.archived_at ?? a.updated_at;
          const right = b.archived_at ?? b.updated_at;
          return new Date(right).getTime() - new Date(left).getTime();
        }),
    [incidents]
  );

  const archivedThisMonth = archived.filter(
    (incident) => archiveMonthOf(incident) === month
  );
  const oldestMonth =
    archived.length > 0 ? archiveMonthOf(archived[archived.length - 1]!) : month;
  const newestMonth = currentYearMonth();

  const ordered = useMemo(() => {
    const copy = [...active];
    copy.sort((a, b) => {
      if (sort === "date_desc") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sort === "date_asc") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      const cmp = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      return sort === "title_asc" ? cmp : -cmp;
    });
    return copy;
  }, [active, sort]);

  const selected = incidents.find((incident) => incident.id === selectedId) ?? null;

  const sorts: { key: SortKey; label: string }[] = [
    { key: "date_desc", label: t.incidents.sortDateDesc },
    { key: "date_asc", label: t.incidents.sortDateAsc },
    { key: "title_asc", label: t.incidents.sortAz },
    { key: "title_desc", label: t.incidents.sortZa },
  ];

  function run(action: () => Promise<{ ok: boolean; message: string }>, close = false) {
    startTransition(async () => {
      const result = await action();
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
      if (result.ok) {
        setConfirmDelete(false);
        if (close) setSelectedId(null);
        router.refresh();
      }
    });
  }

  function openIncident(incidentId: string) {
    setConfirmDelete(false);
    setNotice(null);
    setSelectedId(incidentId);
  }

  return (
    <div className="flex flex-col gap-4">
      {notice && !archivesOpen ? (
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
            {t.incidents.back}
          </button>
        </div>
      ) : null}

      {archivesOpen ? (
        <Card>
          <CardHeader
            title={formatYearMonth(month, dateLocale(locale))}
            hint={`${archivedThisMonth.length} · ${t.incidents.archives}`}
          >
            <button
              type="button"
              className="console-btn-quiet"
              disabled={month <= oldestMonth}
              aria-label={t.incidents.monthPrev}
              onClick={() => setMonth(shiftYearMonth(month, -1))}
            >
              ‹
            </button>
            <button
              type="button"
              className="console-btn-quiet"
              disabled={month >= newestMonth}
              aria-label={t.incidents.monthNext}
              onClick={() => setMonth(shiftYearMonth(month, 1))}
            >
              ›
            </button>
          </CardHeader>
          {notice ? (
            <div className="border-b border-[var(--edl-border)] px-4 py-2.5">
              <p
                className="font-sans text-[11px]"
                style={{
                  color: notice.tone === "ok" ? "var(--edl-emerald)" : "var(--edl-danger)",
                }}
                role="status"
              >
                {notice.text}
              </p>
            </div>
          ) : null}
          {archivedThisMonth.length === 0 ? (
            <EmptyState
              title={t.incidents.emptyArchives}
              detail={t.incidents.emptyArchivesDetail}
            />
          ) : (
            <Table
              head={[
                t.incidents.columnIncident,
                t.incidents.columnHotel,
                t.incidents.columnStatus,
                t.incidents.archivedOn,
              ]}
            >
              {archivedThisMonth.map((incident) => (
                <Row key={incident.id}>
                  <Cell>
                    <button
                      type="button"
                      onClick={() => openIncident(incident.id)}
                      className="text-left font-medium text-[var(--edl-text)] underline-offset-2 hover:underline"
                    >
                      {incident.title}
                    </button>
                    <p className={`mt-0.5 line-clamp-1 ${TYPE.meta}`}>
                      {incident.description}
                    </p>
                  </Cell>
                  <Cell>
                    {incident.tenant_name}
                    <span className={`ml-2 ${TYPE.meta}`}>{incident.tenant_slug}</span>
                  </Cell>
                  <Cell>
                    <Status
                      tone={incidentStatusTone(incident.status)}
                      label={t.labels.incidentStatus[incident.status] ?? incident.status}
                    />
                  </Cell>
                  <Cell>
                    {formatDateTime(incident.archived_at ?? incident.updated_at, locale)}
                  </Cell>
                </Row>
              ))}
            </Table>
          )}
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-[var(--edl-border)] px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <h2 className={`${TYPE.h2} pb-1`}>
                {`${active.length} ${t.modules.incidents.label.toLowerCase()}`}
              </h2>
              <label className="block min-w-[10rem]">
                <span className={TYPE.eyebrow}>{t.incidents.sort}</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  className="console-input mt-1.5 h-8"
                >
                  {sorts.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              className="console-btn-secondary ml-auto h-8"
              onClick={() => {
                const withData = archived[0]
                  ? archiveMonthOf(archived[0])
                  : currentYearMonth();
                setMonth(withData);
                setArchivesOpen(true);
              }}
            >
              {t.incidents.archives}
            </button>
          </div>

          {ordered.length === 0 ? (
            <EmptyState title={t.incidents.emptyTitle} detail={t.incidents.emptyDetail} />
          ) : (
            <Table
              head={[
                t.incidents.columnIncident,
                t.incidents.columnHotel,
                t.incidents.columnPriority,
                t.incidents.columnStatus,
                t.incidents.columnOpened,
              ]}
            >
              {ordered.map((incident) => (
                <Row key={incident.id}>
                  <Cell>
                    <button
                      type="button"
                      onClick={() => openIncident(incident.id)}
                      className="text-left font-medium text-[var(--edl-text)] underline-offset-2 hover:underline"
                    >
                      {incident.title}
                    </button>
                    <p className={`mt-0.5 line-clamp-1 ${TYPE.meta}`}>
                      {incident.description}
                    </p>
                  </Cell>
                  <Cell>
                    {incident.tenant_name}
                    <span className={`ml-2 ${TYPE.meta}`}>{incident.tenant_slug}</span>
                  </Cell>
                  <Cell>
                    <Status
                      tone={ticketPriorityTone(incident.priority)}
                      label={t.labels.priority[incident.priority] ?? incident.priority}
                    />
                  </Cell>
                  <Cell>
                    <Status
                      tone={incidentStatusTone(incident.status)}
                      label={t.labels.incidentStatus[incident.status] ?? incident.status}
                    />
                  </Cell>
                  <Cell>{formatDateTime(incident.created_at, locale)}</Cell>
                </Row>
              ))}
            </Table>
          )}
        </Card>
      )}

      {selected ? (
        <ConsoleModal
          open
          title={selected.title}
          hint={`${selected.tenant_name} · ${formatDateTime(selected.created_at, locale)}`}
          closeLabel={t.access.close}
          size="lg"
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
                      onClick={() => run(() => deleteIncident(selected.id), true)}
                      style={{ background: "var(--edl-danger)", color: "#0b0f17" }}
                    >
                      {pending ? t.incidents.deleting : t.incidents.confirmDelete}
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
                    {t.incidents.delete}
                  </button>
                )
              ) : confirmDelete ? (
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
                    onClick={() => run(() => deleteIncident(selected.id), true)}
                    style={{ background: "var(--edl-danger)", color: "#0b0f17" }}
                  >
                    {pending ? t.incidents.deleting : t.incidents.confirmDelete}
                  </button>
                </>
              ) : (
                <>
                  {canCreateTicket ? (
                    <button
                      type="button"
                      className="console-btn-secondary mr-auto"
                      disabled={pending}
                      onClick={() => setTicketForId(selected.id)}
                    >
                      {t.incidents.createTicket}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="console-btn-secondary"
                    disabled={pending || selected.status === "suspended"}
                    onClick={() => run(() => setIncidentStatus(selected.id, "suspended"))}
                  >
                    {t.incidents.suspend}
                  </button>
                  <button
                    type="button"
                    className="console-btn-secondary"
                    disabled={pending || selected.status === "closed"}
                    onClick={() => run(() => setIncidentStatus(selected.id, "closed"))}
                  >
                    {t.incidents.close}
                  </button>
                  <button
                    type="button"
                    className="console-btn-secondary"
                    disabled={pending}
                    onClick={() => run(() => archiveIncident(selected.id), true)}
                  >
                    {t.incidents.archive}
                  </button>
                  <button
                    type="button"
                    className="console-btn-quiet"
                    disabled={pending}
                    style={{ color: "var(--edl-danger)" }}
                    onClick={() => setConfirmDelete(true)}
                  >
                    {t.incidents.delete}
                  </button>
                </>
              )
            ) : canCreateTicket && selected.status !== "archived" ? (
              <button
                type="button"
                className="console-btn-primary"
                onClick={() => setTicketForId(selected.id)}
              >
                {t.incidents.createTicket}
              </button>
            ) : null
          }
        >
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className={TYPE.eyebrow}>{t.incidents.columnHotel}</dt>
              <dd className="mt-1 font-sans text-[12px] text-[var(--edl-text)]">
                {selected.tenant_name}
                <span className={`ml-2 ${TYPE.meta}`}>{selected.tenant_slug}</span>
              </dd>
            </div>
            <div>
              <dt className={TYPE.eyebrow}>{t.incidents.columnStatus}</dt>
              <dd className="mt-1">
                <Status
                  tone={incidentStatusTone(selected.status)}
                  label={t.labels.incidentStatus[selected.status] ?? selected.status}
                />
              </dd>
            </div>
            <div>
              <dt className={TYPE.eyebrow}>{t.incidents.columnPriority}</dt>
              <dd className="mt-1">
                <Status
                  tone={ticketPriorityTone(selected.priority)}
                  label={t.labels.priority[selected.priority] ?? selected.priority}
                />
              </dd>
            </div>
            <div>
              <dt className={TYPE.eyebrow}>{t.incidents.columnOpened}</dt>
              <dd className="mt-1 font-sans text-[12px] text-[var(--edl-text-soft)]">
                {formatDateTime(selected.created_at, locale)}
              </dd>
            </div>
          </dl>

          <p className={`mt-4 ${TYPE.eyebrow}`}>{t.incidents.report}</p>
          <p className={`mt-1.5 whitespace-pre-wrap ${TYPE.body}`}>{selected.description}</p>
        </ConsoleModal>
      ) : null}

      {selected && ticketForId === selected.id ? (
        <ConsoleModal
          open
          layer={60}
          size="lg"
          title={t.incidents.ticketTitle}
          hint={t.incidents.ticketHint}
          closeLabel={t.access.close}
          onClose={() => setTicketForId(null)}
        >
          <WorkTicketForm
            key={selected.id}
            compact
            assignees={assignees}
            defaults={{
              title: `Incident : ${selected.title}`.slice(0, 200),
              description: `[Incident] ${selected.tenant_name}\n\n${selected.description}`,
              priority: selected.priority,
              sourceIncidentId: selected.id,
            }}
            onCreated={() => {
              setTicketForId(null);
              setNotice({ tone: "ok", text: t.incidents.ticketCreated });
            }}
          />
        </ConsoleModal>
      ) : null}
    </div>
  );
}
