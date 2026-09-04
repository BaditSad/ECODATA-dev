"use client";

import { useState, useTransition } from "react";
import { revokeSensorKey, rotateSensorKey } from "@/app/(admin)/admin/clients/[id]/actions";
import { Cell, Row, Status, Table, TYPE } from "@/components/console/ui";
import {
  batteryTone,
  formatRelative,
  isPingStale,
  SENSOR_STATUS_LABEL,
  sensorStatusTone,
  signalLabel,
} from "@/lib/format";
import type { SensorBaliseRow } from "@/types/database";

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
}: {
  tenantId: string;
  sensors: SensorBaliseRow[];
  now: number;
}) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);

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
          "Unit",
          "Hardware ID",
          "Status",
          "Battery",
          "Signal",
          "Last ping",
          "Key",
          "",
        ]}
        empty="No balises provisioned for this resort yet."
      >
        {sensors.map((sensor) => {
          const stale = isPingStale(sensor.last_ping, now);
          const signal = signalLabel(sensor.signal_rssi_dbm);
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
                  label={SENSOR_STATUS_LABEL[sensor.status]}
                />
              </Cell>

              <Cell align="right">
                <Status
                  tone={batteryTone(sensor.battery_level)}
                  label={
                    sensor.battery_level === null
                      ? "—"
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
                  {formatRelative(sensor.last_ping, now)}
                </span>
              </Cell>

              <Cell mono>
                {revoked ? (
                  <span style={{ color: "var(--edl-danger)" }}>revoked</span>
                ) : (
                  `…${sensor.api_key_last_four}`
                )}
              </Cell>

              <Cell>
                <span className="flex items-center justify-end gap-1">
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
                    {busy ? "…" : "Rotate key"}
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
                      Revoke
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
