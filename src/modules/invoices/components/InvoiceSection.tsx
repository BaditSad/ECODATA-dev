import { InvoiceForm } from "@/modules/invoices/components/InvoiceForm";
import { InvoiceActions } from "@/modules/invoices/components/InvoiceActions";
import type { InvoiceListItem } from "@/modules/invoices/data";
import {
  Card,
  CardHeader,
  Cell,
  Row,
  Status,
  Table,
} from "@/components/console/ui";
import {
  formatDate,
  formatMoney,
  invoiceStatusTone,
} from "@/lib/format";
import { currentLocale, messages } from "@/i18n/server";

export function InvoiceSection({
  invoices,
  contracts,
  canWrite,
  now,
}: {
  invoices: InvoiceListItem[];
  contracts: { id: string; starts_on: string; ends_on: string; status: string }[];
  canWrite: boolean;
  now: number;
}) {
  const t = messages();
  const locale = currentLocale();
  const rangeSep = locale === "fr" ? " au " : " to ";

  return (
    <Card>
      <CardHeader title={t.invoicesUi.title} hint={t.invoicesUi.hint} />
      {canWrite ? <InvoiceForm contracts={contracts} /> : null}
      <div className={canWrite ? "border-t border-[var(--edl-border)]" : undefined}>
        <Table
          head={[
            t.invoicesUi.number,
            t.invoicesUi.contract,
            t.invoicesUi.issued,
            t.invoicesUi.due,
            t.invoicesUi.amount,
            t.invoicesUi.status,
            "",
          ]}
          empty={t.invoicesUi.empty}
        >
          {invoices.map((invoice) => {
            const overdue =
              invoice.status === "issued" &&
              new Date(`${invoice.due_on}T00:00:00Z`).getTime() < now;

            return (
              <Row key={invoice.id}>
                <Cell mono>{invoice.number}</Cell>
                <Cell>
                  {invoice.contract_starts_on && invoice.contract_ends_on
                    ? `${formatDate(invoice.contract_starts_on, locale)}${rangeSep}${formatDate(invoice.contract_ends_on, locale)}`
                    : t.empty}
                </Cell>
                <Cell>{formatDate(invoice.issued_on, locale)}</Cell>
                <Cell>{formatDate(invoice.due_on, locale)}</Cell>
                <Cell align="right" mono>
                  {formatMoney(
                    invoice.amount_cents + invoice.tax_cents,
                    invoice.currency
                  )}
                </Cell>
                <Cell>
                  <Status
                    tone={invoiceStatusTone(invoice.status, invoice.due_on, now)}
                    label={
                      overdue
                        ? t.labels.invoiceOverdue
                        : t.labels.invoice[invoice.status] ?? invoice.status
                    }
                  />
                </Cell>
                <Cell>
                  <InvoiceActions
                    invoiceId={invoice.id}
                    canWrite={canWrite}
                    issued={invoice.status === "issued"}
                  />
                </Cell>
              </Row>
            );
          })}
        </Table>
      </div>
    </Card>
  );
}
