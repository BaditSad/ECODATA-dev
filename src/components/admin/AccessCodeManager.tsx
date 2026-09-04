"use client";

import { useState, useTransition } from "react";
import {
  revokeGuestCode,
  rotateGuestCodes,
  rotateLobbyCode,
} from "@/app/(admin)/admin/clients/[id]/actions";
import { Cell, Row, Status, Table, TYPE } from "@/components/console/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import type { TenantAccessCodeRow } from "@/types/database";

/**
 * Guest PIN and lobby code oversight.
 *
 * Codes are read-only here by design: the rotation engine is the single writer,
 * because hand-editing a validity window would break the gapless-coverage
 * guarantee the overlap depends on. The only writes exposed are "rotate" and
 * "revoke", both of which the engine understands.
 */
export function AccessCodeManager({
  tenantId,
  lobbyCode,
  lobbyRotatedAt,
  codes,
  now,
}: {
  tenantId: string;
  lobbyCode: string;
  lobbyRotatedAt: string;
  codes: TenantAccessCodeRow[];
  now: number;
}) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );
  const [desiredLobbyCode, setDesiredLobbyCode] = useState("");

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
    });
  }

  function codeState(code: TenantAccessCodeRow): {
    label: string;
    tone: "positive" | "attention" | "neutral" | "critical";
  } {
    if (code.revoked_at) return { label: "Revoked", tone: "critical" };

    const from = new Date(code.valid_from).getTime();
    const until = new Date(code.valid_until).getTime();

    if (now < from) return { label: "Scheduled", tone: "neutral" };
    if (now > until) return { label: "Expired", tone: "neutral" };

    // Inside the final two weeks the successor is already live, so this code is
    // serving only guests who arrived before the rollover.
    const overlapWindowMs = 14 * 86_400_000;
    if (until - now <= overlapWindowMs) {
      return { label: "Live · winding down", tone: "attention" };
    }
    return { label: "Live", tone: "positive" };
  }

  const liveCodes = codes.filter(
    (code) =>
      !code.revoked_at &&
      new Date(code.valid_from).getTime() <= now &&
      new Date(code.valid_until).getTime() >= now
  );

  return (
    <>
      <div className="border-b border-[var(--edl-border)] px-4 py-3.5">
        <p className={TYPE.eyebrow}>Master lobby code</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="rounded border border-[var(--edl-border-strong)] bg-[var(--edl-bg)] px-2.5 py-1.5 font-mono text-[13px] tracking-[0.08em] text-[var(--edl-text)]">
            {lobbyCode}
          </code>
          <span className={TYPE.meta}>
            rotated {formatDate(lobbyRotatedAt)}
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <input
            value={desiredLobbyCode}
            onChange={(event) => setDesiredLobbyCode(event.target.value)}
            placeholder="Optional custom code"
            maxLength={32}
            className="console-input h-8 max-w-[15rem] font-mono uppercase"
            aria-label="Custom lobby code"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await rotateLobbyCode(tenantId, desiredLobbyCode);
                if (result.ok) setDesiredLobbyCode("");
                return result;
              })
            }
            className="console-btn-secondary"
          >
            {pending ? "Working…" : "Rotate lobby code"}
          </button>
        </div>

        <p className={`mt-2 ${TYPE.meta}`}>
          Lobby codes never expire. Rotating is the only way to unpair a display,
          so every screen in the hall must be re-paired afterwards.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--edl-border)] px-4 py-3">
        <div className="min-w-0">
          <p className={TYPE.eyebrow}>Guest PIN cycles</p>
          <p className={`mt-0.5 ${TYPE.meta}`}>
            {liveCodes.length === 0
              ? "No code is currently live — guests cannot sign in."
              : liveCodes.length === 1
                ? "One code live. The next rollover will add a second for two weeks."
                : `${liveCodes.length} codes live — currently inside the rollover overlap.`}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => rotateGuestCodes(tenantId))}
          className="console-btn-primary"
        >
          {pending ? "Working…" : "Bring cycles up to date"}
        </button>
      </div>

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
        head={["Cycle", "PIN", "State", "Valid from", "Valid until", ""]}
        empty="No guest codes issued yet. Run a rotation to open guest access."
      >
        {codes.map((code) => {
          const state = codeState(code);
          const active = !code.revoked_at && state.label.startsWith("Live");

          return (
            <Row key={code.id}>
              <Cell align="right">{code.cycle_index}</Cell>
              <Cell mono>
                <span className="text-[13px] tracking-[0.14em] text-[var(--edl-text)]">
                  {code.code}
                </span>
              </Cell>
              <Cell>
                <Status tone={state.tone} label={state.label} />
              </Cell>
              <Cell align="right">{formatDateTime(code.valid_from)}</Cell>
              <Cell align="right">{formatDateTime(code.valid_until)}</Cell>
              <Cell>
                {active ? (
                  <span className="flex justify-end">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => revokeGuestCode(tenantId, code.id))}
                      className="console-btn-quiet"
                      style={{ color: "var(--edl-danger)" }}
                    >
                      Revoke
                    </button>
                  </span>
                ) : null}
              </Cell>
            </Row>
          );
        })}
      </Table>
    </>
  );
}
