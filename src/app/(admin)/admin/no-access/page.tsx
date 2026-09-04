import type { Metadata } from "next";
import { requireErpSession, visibleModules } from "@/lib/auth/erp";
import { signOut } from "@/lib/auth/actions";
import { Card, EmptyState, Page, PageHeader } from "@/components/console/ui";
import { messages } from "@/i18n/server";
import { fill } from "@/i18n/console";

/**
 * Terminal destination for an account with no usable module.
 *
 * Every module guard redirects here when it has nowhere better to send
 * someone, so this page requires a session and nothing else. Guarding it by
 * module would make the redirect bounce.
 */

export async function generateMetadata(): Promise<Metadata> {
  return { title: messages().noAccess.title };
}
export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  const session = await requireErpSession();
  const modules = visibleModules(session);
  const copy = messages();

  return (
    <Page>
      <PageHeader title={copy.noAccess.title} purpose={copy.noAccess.purpose} />

      <Card>
        <EmptyState
          title={
            modules.length === 0 ? copy.noAccess.noneGranted : copy.noAccess.notYours
          }
          detail={fill(copy.noAccess.detail, { email: session.email })}
          action={
            <form action={signOut}>
              <button type="submit" className="console-btn-secondary">
                {copy.noAccess.signOut}
              </button>
            </form>
          }
        />
      </Card>
    </Page>
  );
}
