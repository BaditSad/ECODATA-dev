"use client";

import { useState, useTransition } from "react";
import {
  addNetworkCidrFromForm,
  claimCurrentNetwork,
  issueRemotePass,
  removeNetworkCidr,
  revokeRemotePass,
  updateAccessWindows,
} from "@/app/(tenant)/hotel-portal/actions";
import { TYPE } from "@/components/console/ui";
import type { RemoteAccessPassRow } from "@/types/database";

export function NetworkAccess({
  cidrs,
  onNetworkHours,
  remoteSessionHours,
  seenIp,
  suggestedCidr,
  passes,
  canEdit,
}: {
  cidrs: string[];
  onNetworkHours: number;
  remoteSessionHours: number;
  seenIp: string | null;
  suggestedCidr: string | null;
  passes: RemoteAccessPassRow[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);

  function run(action: () => Promise<{
    ok: boolean;
    message: string;
    remoteUrl?: string;
  }>) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
      if (result.remoteUrl) setIssuedUrl(result.remoteUrl);
    });
  }

  return (
    <div className="px-4 py-3.5">
      <p className={TYPE.body}>
        Devices on a registered prefix open the guest view and the hall display
        without a code. Reception controls who is on the Wi-Fi; Eco-Data Link
        only sees the address this request arrived from
        {seenIp ? (
          <>
            {" "}
            (<span className="font-mono text-[11px]">{seenIp}</span>)
          </>
        ) : null}
        . Off-site access still works, but only for a few hours.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <form
          action={(formData) => run(() => updateAccessWindows(formData))}
          className="contents"
        >
          <label className="block">
            <span className={TYPE.eyebrow}>On Wi-Fi (hours)</span>
            <span className={`mt-0.5 block ${TYPE.meta}`}>
              Renewed while the device stays on a registered prefix.
            </span>
            <input
              name="onNetworkHours"
              type="number"
              min={1}
              max={24}
              defaultValue={onNetworkHours}
              disabled={!canEdit || pending}
              className="console-input mt-1.5 h-8 font-mono"
            />
          </label>
          <label className="block">
            <span className={TYPE.eyebrow}>Off-site (hours)</span>
            <span className={`mt-0.5 block ${TYPE.meta}`}>
              PIN, lobby code and remote links. Not renewed.
            </span>
            <input
              name="remoteSessionHours"
              type="number"
              min={1}
              max={12}
              defaultValue={remoteSessionHours}
              disabled={!canEdit || pending}
              className="console-input mt-1.5 h-8 font-mono"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={!canEdit || pending}
              className="rounded-md border border-[var(--edl-border)] px-3 py-1.5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--edl-text)] disabled:opacity-40"
            >
              Save windows
            </button>
          </div>
        </form>
      </div>

      <div className="mt-5 border-t border-[var(--edl-border)] pt-4">
        <p className={TYPE.eyebrow}>Registered prefixes</p>
        {cidrs.length === 0 ? (
          <p className={`mt-2 ${TYPE.meta}`}>
            None yet. Register this Wi-Fi from a device that is already on it —
            typically the hotel&apos;s public address after NAT.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--edl-border)]">
            {cidrs.map((cidr) => (
              <li
                key={cidr}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="font-mono text-[12px] text-[var(--edl-text)]">
                  {cidr}
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => removeNetworkCidr(cidr))}
                    className="font-sans text-[11px] text-[var(--edl-muted)] hover:text-[var(--edl-danger)]"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canEdit || pending || !suggestedCidr}
            onClick={() => run(() => claimCurrentNetwork())}
            className="rounded-md border px-3 py-1.5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] disabled:opacity-40"
            style={{
              borderColor: "var(--edl-emerald-30)",
              color: "var(--edl-emerald)",
              background: "var(--edl-emerald-10)",
            }}
          >
            Register this Wi-Fi
            {suggestedCidr ? ` (${suggestedCidr})` : ""}
          </button>
        </div>

        <form
          action={(formData) => run(() => addNetworkCidrFromForm(formData))}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <label className="min-w-[12rem] flex-1">
            <span className={TYPE.eyebrow}>Or enter a prefix</span>
            <input
              name="cidr"
              placeholder="203.0.113.40/32"
              disabled={!canEdit || pending}
              className="console-input mt-1.5 h-8 font-mono"
            />
          </label>
          <button
            type="submit"
            disabled={!canEdit || pending}
            className="h-8 rounded-md border border-[var(--edl-border)] px-3 font-sans text-[11px] font-medium uppercase tracking-[0.12em] disabled:opacity-40"
          >
            Add
          </button>
        </form>
      </div>

      <div className="mt-5 border-t border-[var(--edl-border)] pt-4">
        <p className={TYPE.eyebrow}>Time-limited remote links</p>
        <p className={`mt-1 ${TYPE.meta}`}>
          For someone not on the hotel Wi-Fi. The link lasts{" "}
          {remoteSessionHours} hour{remoteSessionHours === 1 ? "" : "s"} and is
          shown once.
        </p>

        <form
          action={(formData) => {
            setIssuedUrl(null);
            run(() => issueRemotePass(formData));
          }}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <label>
            <span className={TYPE.eyebrow}>Surface</span>
            <select
              name="tier"
              defaultValue="guest"
              disabled={!canEdit || pending}
              className="console-input mt-1.5 h-8"
            >
              <option value="guest">Guest view</option>
              <option value="lobby">Hall display</option>
            </select>
          </label>
          <label className="min-w-[10rem] flex-1">
            <span className={TYPE.eyebrow}>Label (optional)</span>
            <input
              name="label"
              placeholder="Owner, off-site"
              disabled={!canEdit || pending}
              className="console-input mt-1.5 h-8"
            />
          </label>
          <button
            type="submit"
            disabled={!canEdit || pending}
            className="h-8 rounded-md border px-3 font-sans text-[11px] font-medium uppercase tracking-[0.12em] disabled:opacity-40"
            style={{
              borderColor: "var(--edl-emerald-30)",
              color: "var(--edl-emerald)",
            }}
          >
            Issue link
          </button>
        </form>

        {issuedUrl ? (
          <p className="mt-3 break-all rounded-md border border-[var(--edl-gold-40)] bg-[var(--edl-gold-10)] px-3 py-2 font-mono text-[11px] text-[var(--edl-text)]">
            {issuedUrl}
          </p>
        ) : null}

        {passes.length > 0 ? (
          <ul className="mt-3 divide-y divide-[var(--edl-border)]">
            {passes.map((pass) => (
              <li
                key={pass.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div>
                  <p className="font-sans text-[12px] text-[var(--edl-text)]">
                    {pass.label || (pass.tier === "guest" ? "Guest view" : "Hall display")}
                  </p>
                  <p className={TYPE.meta}>
                    {pass.tier} · expires {new Date(pass.expires_at).toLocaleString()}
                  </p>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => revokeRemotePass(pass.id))}
                    className="font-sans text-[11px] text-[var(--edl-muted)] hover:text-[var(--edl-danger)]"
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {notice ? (
        <p
          className={`mt-4 ${TYPE.meta}`}
          style={{
            color: notice.tone === "ok" ? "var(--edl-emerald)" : "var(--edl-danger)",
          }}
          role={notice.tone === "error" ? "alert" : undefined}
        >
          {notice.text}
        </p>
      ) : null}

      {!canEdit ? (
        <p className={`mt-3 ${TYPE.meta}`}>Only the resort manager can change network access.</p>
      ) : null}
    </div>
  );
}
