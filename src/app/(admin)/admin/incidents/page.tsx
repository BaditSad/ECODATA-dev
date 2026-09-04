import type { Metadata } from "next";
import { canModule, requireModule } from "@/lib/auth/erp";
import { messages } from "@/i18n/server";
import { archiveStaleClosedIncidents } from "@/modules/incidents/actions";
import { fetchIncidents } from "@/modules/incidents/data";
import { fetchTicketAssignees } from "@/modules/tickets/data";
import { IncidentsBoard } from "@/modules/incidents/components/IncidentsBoard";
import { Page, PageHeader } from "@/components/console/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messages().modules.incidents.label };
}
export const dynamic = "force-dynamic";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: { open?: string };
}) {
  const session = await requireModule("incidents");
  const canWrite = canModule(session, "incidents", "write");
  const canCreateTicket = canModule(session, "tickets", "write");
  const copy = messages();

  await archiveStaleClosedIncidents();

  const [incidents, assignees] = await Promise.all([
    fetchIncidents(),
    canCreateTicket ? fetchTicketAssignees() : Promise.resolve([]),
  ]);

  return (
    <Page>
      <PageHeader
        title={copy.modules.incidents.label}
        purpose={copy.modules.incidents.purpose}
      />
      <IncidentsBoard
        incidents={incidents}
        canWrite={canWrite}
        canCreateTicket={canCreateTicket}
        assignees={assignees}
        initiallyOpenId={searchParams.open}
      />
    </Page>
  );
}
