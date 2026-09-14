/**
 * Station port power + charge limits (Device Detail)
 */

import type { DeviceLimitsTelemetry, DevicePortsTelemetry } from '@ecoflow/shared';

interface StationPortsLimitsProps {
  ports?: DevicePortsTelemetry;
  limits?: DeviceLimitsTelemetry;
}

function wattRows(ports: DevicePortsTelemetry): Array<{ label: string; value: number }> {
  const rows: Array<{ label: string; value: number }> = [];
  const push = (label: string, value: number | undefined) => {
    if (typeof value === 'number') rows.push({ label, value });
  };
  push('AC in', ports.acInW);
  push('AC out', ports.acOutW);
  if (ports.acOutLinesW) {
    ports.acOutLinesW.forEach((w, i) => {
      if (w > 0) rows.push({ label: `AC out ${i + 1}`, value: w });
    });
  }
  push('PV', ports.pvW);
  push('PV2', ports.pv2W);
  push('12V', ports.dc12vW);
  push('Type-C 1', ports.typec1W);
  push('Type-C 2', ports.typec2W);
  push('Type-C 3', ports.typec3W);
  push('QC USB 1', ports.qcusb1W);
  push('QC USB 2', ports.qcusb2W);
  return rows;
}

export function StationPortsLimits({ ports, limits }: StationPortsLimitsProps) {
  const portRows = ports ? wattRows(ports) : [];
  const hasLimits =
    limits &&
    (limits.maxChargeSoc !== undefined ||
      limits.minDischargeSoc !== undefined ||
      limits.backupReserveSoc !== undefined ||
      limits.energyBackupEnabled !== undefined);

  if (portRows.length === 0 && !hasLimits) {
    return null;
  }

  return (
    <div className="space-y-6">
      {portRows.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Ports
          </h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm text-gray-800 dark:text-gray-200">
            {portRows.map((row) => (
              <div key={row.label} className="flex justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-1">
                <dt className="text-gray-500 dark:text-gray-400">{row.label}</dt>
                <dd className="font-mono">{row.value} W</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {hasLimits && limits && (
        <section>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Limits
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-800 dark:text-gray-200">
            {limits.maxChargeSoc !== undefined && (
              <div className="flex justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-1">
                <dt className="text-gray-500 dark:text-gray-400">Charge ceiling</dt>
                <dd className="font-mono">{limits.maxChargeSoc}%</dd>
              </div>
            )}
            {limits.minDischargeSoc !== undefined && (
              <div className="flex justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-1">
                <dt className="text-gray-500 dark:text-gray-400">Discharge floor</dt>
                <dd className="font-mono">{limits.minDischargeSoc}%</dd>
              </div>
            )}
            {limits.backupReserveSoc !== undefined && (
              <div className="flex justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-1">
                <dt className="text-gray-500 dark:text-gray-400">Backup reserve</dt>
                <dd className="font-mono">{limits.backupReserveSoc}%</dd>
              </div>
            )}
            {limits.energyBackupEnabled !== undefined && (
              <div className="flex justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-1">
                <dt className="text-gray-500 dark:text-gray-400">Energy backup</dt>
                <dd>{limits.energyBackupEnabled ? 'On' : 'Off'}</dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}
