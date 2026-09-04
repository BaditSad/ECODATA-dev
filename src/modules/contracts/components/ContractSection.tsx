import { ContractForm } from "@/modules/contracts/components/ContractForm";
import { CancelContractButton } from "@/modules/contracts/components/CancelContractButton";
import type { ContractListItem } from "@/modules/contracts/data";
import {
  Card,
  CardHeader,
  Cell,
  Row,
  Status,
  Table,
} from "@/components/console/ui";
import {
  contractStatusTone,
  daysUntil,
  formatDate,
  formatMoney,
} from "@/lib/format";
import { currentLocale, messages } from "@/i18n/server";
import { fill } from "@/i18n/console";

export function ContractSection({
  tenantId,
  contracts,
  canWrite,
}: {
  tenantId: string;
  contracts: ContractListItem[];
  canWrite: boolean;
}) {
  const t = messages();
  const locale = currentLocale();
  const rangeSep = locale === "fr" ? " au " : " to ";

  return (
    <>
      <Card>
        <CardHeader title={t.contractsUi.title} hint={t.contractsUi.hint} />
        {canWrite ? <ContractForm tenantId={tenantId} /> : null}
        <div className={canWrite ? "border-t border-[var(--edl-border)]" : undefined}>
          <Table
            head={[
              t.contractsUi.term,
              t.contractsUi.cycle,
              t.contractsUi.amount,
              t.contractsUi.status,
              t.contractsUi.ends,
              "",
            ]}
            empty={t.contractsUi.empty}
          >
            {contracts.map((contract) => {
              const remaining = daysUntil(contract.ends_on);
              return (
                <Row key={contract.id}>
                  <Cell>
                    {formatDate(contract.starts_on, locale)}
                    {rangeSep}
                    {formatDate(contract.ends_on, locale)}
                  </Cell>
                  <Cell>{t.labels.billing[contract.billing_cycle] ?? contract.billing_cycle}</Cell>
                  <Cell align="right" mono>
                    {formatMoney(contract.amount_cents, contract.currency)}
                  </Cell>
                  <Cell>
                    <Status
                      tone={contractStatusTone(contract.status)}
                      label={t.labels.contract[contract.status] ?? contract.status}
                    />
                  </Cell>
                  <Cell align="right">
                    {contract.status === "active"
                      ? remaining < 0
                        ? t.contractsUi.expired
                        : fill(t.contractsUi.days, { n: remaining })
                      : t.empty}
                  </Cell>
                  <Cell>
                    {canWrite && contract.status === "active" ? (
                      <CancelContractButton contractId={contract.id} />
                    ) : null}
                  </Cell>
                </Row>
              );
            })}
          </Table>
        </div>
      </Card>
    </>
  );
}
