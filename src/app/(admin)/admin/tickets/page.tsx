import type { Metadata } from "next";
import { canModule, requireModule } from "@/lib/auth/erp";
import { messages } from "@/i18n/server";
import {
  archiveStaleDoneTickets,
} from "@/modules/tickets/actions";
import { fetchWorkTickets, fetchTicketAssignees } from "@/modules/tickets/data";
import { TicketsBoard } from "@/modules/tickets/components/TicketsBoard";
import { Page, PageHeader } from "@/components/console/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messages().modules.tickets.label };
}
export const dynamic = "force-dynamic";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { open?: string };
}) {
  const session = await requireModule("tickets");
  const canWrite = canModule(session, "tickets", "write");
  const copy = messages();

  await archiveStaleDoneTickets();

  const [tickets, assignees] = await Promise.all([
    fetchWorkTickets(),
    fetchTicketAssignees(),
  ]);

  return (
    <Page>
      <PageHeader
        title={copy.modules.tickets.label}
        purpose={copy.modules.tickets.purpose}
      />
      <TicketsBoard
        tickets={tickets}
        assignees={assignees}
        canWrite={canWrite}
        initiallyOpenId={searchParams.open}
      />
    </Page>
  );
}
