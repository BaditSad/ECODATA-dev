"use client";

import { useState, useTransition } from "react";
import { revokeSensorKey, rotateSensorKey } from "@/modules/domains/actions/fleet";
import { Cell, Row, Status, Table, TYPE, type Tone } from "@/components/console/ui";
import {
  batteryTone,
  formatRelative,
  isPingStale,
  sensorStatusTone,
} from "@/lib/format";
import type { SensorBaliseRow } from "@/types/database";
import { useMessages } from "@/i18n/LocaleProvider";
import { fill } from "@/i18n/console";

/**
 * Fleet table with credential controls.
 *
 * `now` is passed from the server render rather than read here, so relative
 * timestamps match between server HTML and first client paint.
 */
export function SensorFleetTable({
  tenantId,
  sensors,
  now,
  canWrite,
}: {
  tenantId: string;
  sensors: SensorBaliseRow[];
  now: number;
  /** Credential controls are hidden without the write grant. */
  canWrite: boolean;
}) {
  const t = useMessages();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);

  function fleetSignal(rssi: number | null | undefined): { label: string; tone: Tone } {
    if (rssi === null || rssi === undefined) {
      return { label: t.fleet.noReading, tone: "neutral" };
    }
    if (rssi >= -90) {
      return { label: fill(t.fleet.signalStrong, { rssi }), tone: "positive" };
    }
    if (rssi >= -110) {
      return { label: fill(t.fleet.signalFair, { rssi }), tone: "attention" };
    }
    return { label: fill(t.fleet.signalWeak, { rssi }), tone: "critical" };
  }

  function runAction(
    sensorId: string,
    action: () => Promise<{ ok: boolean; message: string; data?: { rawApiKey: string } }>
  ) {
    setBusyId(sensorId);
    setNotice(null);
    setRotatedKey(null);

    startTransition(async () => {
      const result = await action();
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
      if (result.ok && result.data?.rawApiKey) setRotatedKey(result.data.rawApiKey);
      setBusyId(null);
    });
  }

  return (
    <>
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
          {rotatedKey ? (
            <code className="mt-2 block overflow-x-auto rounded border border-[var(--edl-border-strong)] bg-[var(--edl-bg)] px-2.5 py-2 font-mono text-[11px] text-[var(--edl-text)]">
              {rotatedKey}
            </code>
          ) : null}
        </div>
      ) : null}

      <Table
        head={[
          t.fleet.unit,
          t.fleet.hardware,
          t.fleet.status,
          t.fleet.battery,
          t.fleet.signal,
          t.fleet.lastSeen,
          "",
          "",
        ]}
        empty={t.fleet.empty}
      >
        {sensors.map((sensor) => {
          const stale = isPingStale(sensor.last_ping, now);
          const signal = fleetSignal(sensor.signal_rssi_dbm);
          const revoked = sensor.api_key_revoked_at !== null;
          const busy = pending && busyId === sensor.id;

          return (
            <Row key={sensor.id}>
              <Cell>
                <span className="font-medium text-[var(--edl-text)]">
                  {sensor.name}
                </span>
                {sensor.firmware_version ? (
                  <span className={`ml-2 ${TYPE.meta}`}>
                    fw {sensor.firmware_version}
                  </span>
                ) : null}
              </Cell>

              <Cell mono>{sensor.hardware_id}</Cell>

              <Cell>
                <Status
                  tone={sensorStatusTone(sensor.status)}
                  label={t.labels.sensor[sensor.status] ?? sensor.status}
                />
              </Cell>

              <Cell align="right">
                <Status
                  tone={batteryTone(sensor.battery_level)}
                  label={
                    sensor.battery_level === null
                      ? t.empty
                      : `${sensor.battery_level}%${
                          sensor.battery_voltage
                            ? ` · ${sensor.battery_voltage} V`
                            : ""
                        }`
                  }
                  className="justify-end"
                />
              </Cell>

              <Cell>
                <Status tone={signal.tone} label={signal.label} />
              </Cell>

              <Cell align="right">
                <span style={stale ? { color: "var(--edl-danger)" } : undefined}>
                  {formatRelative(sensor.last_ping, now, t.relative)}
                </span>
              </Cell>

              <Cell mono>
                {revoked ? (
                  <span style={{ color: "var(--edl-danger)" }}>{t.codes.revoked}</span>
                ) : (
                  `…${sensor.api_key_last_four}`
                )}
              </Cell>

              <Cell>
                <span className="flex items-center justify-end gap-1" hidden={!canWrite}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runAction(sensor.id, () =>
                        rotateSensorKey(tenantId, sensor.id)
                      )
                    }
                    className="console-btn-quiet"
                  >
                    {busy ? t.fleet.rotating : t.fleet.rotate}
                  </button>
                  {!revoked ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(sensor.id, () =>
                          revokeSensorKey(tenantId, sensor.id)
                        )
                      }
                      className="console-btn-quiet"
                      style={{ color: "var(--edl-danger)" }}
                    >
                      {t.fleet.revoke}
                    </button>
                  ) : null}
                </span>
              </Cell>
            </Row>
          );
        })}
      </Table>
    </>
  );
}
