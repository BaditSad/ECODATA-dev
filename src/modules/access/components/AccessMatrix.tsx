"use client";

import { useEffect, useMemo, useState, useTransition, type TransitionStartFunction } from "react";
import { useRouter } from "next/navigation";
import {
  deleteErpAccount,
  saveAccountAccess,
} from "@/modules/access/actions";
import { grantableModules } from "@/modules/registry";
import { CreateAccountForm } from "@/modules/access/components/CreateAccountForm";
import { ConsoleModal } from "@/components/console/Modal";
import { Card, CardHeader, Cell, Row, Status, Table, TYPE } from "@/components/console/ui";
import { formatRelative } from "@/lib/format";
import { useMessages } from "@/i18n/LocaleProvider";
import type { ErpAccount } from "@/modules/access/data";
import type { ErpEffectiveAccess } from "@/types/database";

const DELETE_CONFIRM = /^(delete|supprimer)$/i;

export function AccessMatrix({
  accounts,
  currentUserId,
}: {
  accounts: ErpAccount[];
  currentUserId: string;
}) {
  const t = useMessages();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );
  const [creating, setCreating] = useState(false);
  const [createLocked, setCreateLocked] = useState(false);
  const [editing, setEditing] = useState<ErpAccount | null>(null);
  const [deleting, setDeleting] = useState<ErpAccount | null>(null);

  return (
    <>
      <Card>
        <CardHeader
          title={`${accounts.length} ${t.access.account.toLowerCase()}${accounts.length === 1 ? "" : "s"}`}
          hint={t.access.matrixHint}
        >
          <button
            type="button"
            className="console-btn-primary"
            onClick={() => {
              setNotice(null);
              setCreateLocked(false);
              setCreating(true);
            }}
          >
            {t.access.newAccount}
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

      <Table
        head={[t.access.account, t.access.state, t.access.actions]}
        empty={t.access.empty}
      >
        {accounts.map((account) => {
          const isSelf = account.id === currentUserId;
          const canManage = !account.isOwner && !isSelf;

          return (
            <Row key={account.id}>
              <Cell>
                <span className="font-medium text-[var(--edl-text)]">
                  {account.fullName ?? account.email}
                </span>
                {account.fullName ? (
                  <span className={`ml-2 ${TYPE.meta}`}>{account.email}</span>
                ) : null}
                <span className={`block ${TYPE.meta}`}>
                  {account.isOwner ? t.access.owner : t.access.staff}
                  {" · "}
                  {formatRelative(account.lastSeenAt, Date.now(), t.relative)}
                </span>
              </Cell>

              <Cell>
                <Status
                  tone={account.isActive ? "positive" : "neutral"}
                  label={account.isActive ? t.access.active : t.access.deactivated}
                />
              </Cell>

              <Cell>
                {canManage ? (
                  <span className="inline-flex items-center justify-end gap-1">
                    <button
                      type="button"
                      className="console-btn-quiet"
                      onClick={() => {
                        setNotice(null);
                        setEditing(account);
                      }}
                    >
                      {t.access.edit}
                    </button>
                    <button
                      type="button"
                      className="console-btn-quiet"
                      style={{ color: "var(--edl-danger)" }}
                      onClick={() => {
                        setNotice(null);
                        setDeleting(account);
                      }}
                    >
                      {t.access.delete}
                    </button>
                  </span>
                ) : null}
              </Cell>
            </Row>
          );
        })}
      </Table>
        <p className={`border-t border-[var(--edl-border)] px-4 py-3 ${TYPE.meta}`}>
          {t.access.deactivateNote}
        </p>
      </Card>

      {creating ? (
        <ConsoleModal
          open
          title={t.access.newAccount}
          hint={t.access.newHint}
          closeLabel={t.access.close}
          onClose={() => {
            if (createLocked) return;
            setCreating(false);
          }}
        >
          <CreateAccountForm
            compact
            onIssuedChange={setCreateLocked}
            onStored={() => {
              setCreating(false);
              setCreateLocked(false);
              router.refresh();
            }}
          />
        </ConsoleModal>
      ) : null}

      {editing ? (
        <EditAccessModal
          account={editing}
          pending={pending}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setNotice({ tone: "ok", text: message });
            setEditing(null);
            router.refresh();
          }}
          onError={(message) => setNotice({ tone: "error", text: message })}
          startTransition={startTransition}
        />
      ) : null}

      {deleting ? (
        <DeleteAccountModal
          account={deleting}
          pending={pending}
          onClose={() => setDeleting(null)}
          onDeleted={(message) => {
            setNotice({ tone: "ok", text: message });
            setDeleting(null);
            router.refresh();
          }}
          onError={(message) => setNotice({ tone: "error", text: message })}
          startTransition={startTransition}
        />
      ) : null}
    </>
  );
}

function EditAccessModal({
  account,
  pending,
  onClose,
  onSaved,
  onError,
  startTransition,
}: {
  account: ErpAccount;
  pending: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
  startTransition: TransitionStartFunction;
}) {
  const t = useMessages();
  const modules = grantableModules();
  const [grants, setGrants] = useState<Record<string, ErpEffectiveAccess>>(
    () => ({ ...account.grants })
  );
  const [isActive, setIsActive] = useState(account.isActive);

  useEffect(() => {
    setGrants({ ...account.grants });
    setIsActive(account.isActive);
  }, [account]);

  function save() {
    startTransition(async () => {
      const result = await saveAccountAccess(account.id, grants, isActive);
      if (result.ok) onSaved(result.message);
      else onError(result.message);
    });
  }

  return (
    <ConsoleModal
      open
      title={`${t.access.editTitle} · ${account.fullName ?? account.email}`}
      hint={t.access.editHint}
      onClose={pending ? () => undefined : onClose}
      closeLabel={t.access.close}
      footer={
        <>
          <button
            type="button"
            className="console-btn-secondary"
            disabled={pending}
            onClick={onClose}
          >
            {t.access.cancel}
          </button>
          <button
            type="button"
            className="console-btn-primary"
            disabled={pending}
            onClick={save}
          >
            {pending ? t.access.saving : t.access.save}
          </button>
        </>
      }
    >
      <p className={TYPE.meta}>{account.email}</p>

      <label className="mt-3 flex items-center justify-between gap-3">
        <span className={TYPE.eyebrow}>{t.access.accountState}</span>
        <select
          value={isActive ? "active" : "inactive"}
          disabled={pending}
          onChange={(event) => setIsActive(event.target.value === "active")}
          className="console-input h-8 w-[11rem]"
        >
          <option value="active">{t.access.active}</option>
          <option value="inactive">{t.access.deactivated}</option>
        </select>
      </label>

      <ul className="mt-3 divide-y divide-[var(--edl-border)]">
        {modules.map((module) => {
          const value = grants[module.key] ?? "none";
          return (
            <li
              key={module.key}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0">
                <span className="block font-sans text-[12px] text-[var(--edl-text)]">
                  {t.modules[module.key].label}
                </span>
                <span className={`block ${TYPE.meta}`}>
                  {t.modules[module.key].purpose}
                </span>
              </span>
              <select
                value={value}
                disabled={pending}
                aria-label={`${t.modules[module.key].label} : ${account.email}`}
                onChange={(event) => {
                  const next = event.target.value as ErpEffectiveAccess;
                  setGrants((current) => ({ ...current, [module.key]: next }));
                }}
                className="console-input h-8 w-[11rem] shrink-0"
              >
                <option value="none">{t.access.none}</option>
                <option value="read">{t.access.read}</option>
                <option value="write">{t.access.write}</option>
              </select>
            </li>
          );
        })}
      </ul>
    </ConsoleModal>
  );
}

function DeleteAccountModal({
  account,
  pending,
  onClose,
  onDeleted,
  onError,
  startTransition,
}: {
  account: ErpAccount;
  pending: boolean;
  onClose: () => void;
  onDeleted: (message: string) => void;
  onError: (message: string) => void;
  startTransition: TransitionStartFunction;
}) {
  const t = useMessages();
  const [typed, setTyped] = useState("");
  const confirmed = useMemo(() => DELETE_CONFIRM.test(typed.trim()), [typed]);

  function destroy() {
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteErpAccount(account.id);
      if (result.ok) onDeleted(result.message);
      else onError(result.message);
    });
  }

  return (
    <ConsoleModal
      open
      title={t.access.deleteTitle}
      hint={account.fullName ?? account.email}
      onClose={pending ? () => undefined : onClose}
      closeLabel={t.access.close}
      footer={
        <>
          <button
            type="button"
            className="console-btn-secondary"
            disabled={pending}
            onClick={onClose}
          >
            {t.access.cancel}
          </button>
          <button
            type="button"
            className="console-btn-primary"
            disabled={pending || !confirmed}
            onClick={destroy}
            style={{
              background: confirmed ? "var(--edl-danger)" : undefined,
              color: confirmed ? "#0b0f17" : undefined,
            }}
          >
            {pending ? t.access.deleting : t.access.deleteConfirm}
          </button>
        </>
      }
    >
      <p className={TYPE.body}>{t.access.deleteLead}</p>
      <p className={`mt-2 ${TYPE.meta}`}>{account.email}</p>

      <label className="mt-4 block">
        <span className={TYPE.eyebrow}>{t.access.typeLabel}</span>
        <p className={`mt-1 ${TYPE.meta}`}>{t.access.deleteHint}</p>
        <input
          type="text"
          autoComplete="off"
          autoFocus
          spellCheck={false}
          value={typed}
          disabled={pending}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              destroy();
            }
          }}
          className="console-input mt-1.5 h-8 font-mono"
          placeholder="delete / supprimer"
        />
      </label>
    </ConsoleModal>
  );
}
