import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/erp";
import { messages } from "@/i18n/server";
import { fetchErpAccounts } from "@/modules/access/data";
import { AccessMatrix } from "@/modules/access/components/AccessMatrix";
import { Page, PageHeader } from "@/components/console/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messages().modules.access.label };
}
export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const session = await requireOwner();
  const accounts = await fetchErpAccounts();
  const copy = messages();

  return (
    <Page>
      <PageHeader title={copy.modules.access.label} purpose={copy.modules.access.purpose} />
      <AccessMatrix accounts={accounts} currentUserId={session.userId} />
    </Page>
  );
}
