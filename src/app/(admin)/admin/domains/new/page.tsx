import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardHeader,
  Page,
  PageHeader,
  TYPE,
} from "@/components/console/ui";
import { CreateTenantForm } from "@/modules/domains/components/CreateTenantForm";
import { requireModule } from "@/lib/auth/erp";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messages().domains.onboard };
}

export default async function NewDomainPage() {
  await requireModule("domains", "write");
  const copy = messages();

  return (
    <Page>
      <Link
        href="/admin/domains"
        className="inline-flex items-center gap-1.5 font-sans text-[11px] text-[var(--edl-muted)] transition-colors hover:text-[var(--edl-text)]"
      >
        <ArrowLeft size={12} aria-hidden />
        {copy.domains.backToList}
      </Link>

      <PageHeader title={copy.domains.newTitle} purpose={copy.domains.newPurpose} />

      <Card>
        <CardHeader title={copy.domains.newContract} hint={copy.domains.newContractHint} />
        <CreateTenantForm />
      </Card>

      <Card>
        <CardHeader title={copy.domains.newMotion} />
        <div className="px-4 py-3.5">
          <p className={TYPE.body}>{copy.domains.newMotionP1}</p>
          <p className={`mt-2 ${TYPE.body}`}>{copy.domains.newMotionP2}</p>
        </div>
      </Card>
    </Page>
  );
}
