import type { Metadata } from "next";
import { canModule, requireModule } from "@/lib/auth/erp";
import { currentLocale, messages } from "@/i18n/server";
import { fill } from "@/i18n/console";
import { fetchAccountingSnapshot } from "@/modules/accounting/data";
import { LedgerEntryButton } from "@/modules/accounting/components/LedgerForm";
import {
  Card,
  CardHeader,
  Cell,
  EmptyState,
  Metric,
  MetricRow,
  Page,
  PageHeader,
  Row,
  Status,
  Table,
} from "@/components/console/ui";
import { formatDate, formatMoney } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: messages().modules.accounting.label };
}

export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  const session = await requireModule("accounting");
  const canWrite = canModule(session, "accounting", "write");
  const snapshot = await fetchAccountingSnapshot();
  const copy = messages();
  const locale = currentLocale();

  return (
    <Page>
      <PageHeader
        title={copy.modules.accounting.label}
        purpose={copy.modules.accounting.purpose}
      />

      <MetricRow>
        <Metric
          label={copy.accountingUi.mrr}
          value={formatMoney(snapshot.mrrCents)}
          hint={fill(copy.accountingUi.mrrHint, {
            arr: formatMoney(snapshot.arrCents),
          })}
        />
        <Metric
          label={copy.accountingUi.openInvoices}
          value={formatMoney(snapshot.issuedCents)}
          hint={copy.accountingUi.openInvoicesHint}
        />
        <Metric
          label={copy.accountingUi.overdue}
          value={formatMoney(snapshot.overdueCents)}
          tone={snapshot.overdueCents > 0 ? "critical" : "positive"}
        />
        <Metric
          label={copy.accountingUi.collected}
          value={formatMoney(snapshot.collectedCents)}
          hint={copy.accountingUi.collectedHint}
          tone="positive"
        />
        <Metric
          label={copy.accountingUi.expenses}
          value={formatMoney(snapshot.expenseCents)}
          hint={copy.accountingUi.expensesHint}
        />
      </MetricRow>

      <Card>
        <CardHeader title={copy.accounting.ledger} hint={copy.accounting.ledgerHint}>
          {canWrite ? <LedgerEntryButton tenants={snapshot.tenants} /> : null}
        </CardHeader>
        {snapshot.entries.length === 0 ? (
          <EmptyState
            title={copy.accountingUi.emptyTitle}
            detail={copy.accountingUi.emptyDetail}
          />
        ) : (
          <Table
            head={[
              copy.accountingUi.colDate,
              copy.accountingUi.colKind,
              copy.accountingUi.colDomain,
              copy.accountingUi.colMemo,
              copy.accountingUi.colAmount,
            ]}
          >
            {snapshot.entries.map((entry) => (
              <Row key={entry.id}>
                <Cell>{formatDate(entry.occurred_on, locale)}</Cell>
                <Cell>
                  <Status
                    tone={entry.kind === "expense" ? "attention" : "neutral"}
                    label={
                      entry.kind === "expense"
                        ? copy.accounting.expense
                        : copy.accounting.adjustment
                    }
                  />
                </Cell>
                <Cell>{entry.tenant_name ?? copy.accounting.platform}</Cell>
                <Cell>{entry.memo}</Cell>
                <Cell align="right">
                  {formatMoney(entry.amount_cents, entry.currency)}
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </Card>
    </Page>
  );
}
