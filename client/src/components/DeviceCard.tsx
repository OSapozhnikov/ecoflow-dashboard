/**
 * Device Card Component
 */

import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  deviceFamilyLabel,
  isSmartPlugFamily,
  PLUG_POWER_CONFIG,
  resolveDeviceFamily,
} from '@ecoflow/shared';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { BatteryIndicator } from './BatteryIndicator';
import { SourceBadge } from './SourceBadge';
import { formatDeviceStatusError } from '../utils/formatDeviceStatusError';
import { formatRemainingMinutes } from '../utils/formatRemainingTime';
import type { Device } from '../types/ecoflow';

interface DeviceCardProps {
  device: Device | Record<string, unknown>;
}

export const DeviceCard = memo(function DeviceCard({ device }: DeviceCardProps) {
  // Safe property access with fallbacks - memoized to avoid recalculation
  const deviceId = useMemo((): string => {
    const d = device as Device & Record<string, unknown>;
    const id = d.sn || d.deviceSn || d.deviceId || d.sn;
    return typeof id === 'string' ? id : '';
  }, [device]);

  const deviceName = useMemo((): string => {
    const d = device as Device & Record<string, unknown>;
    const name = d.deviceName || d.name;
    return typeof name === 'string' ? name : 'Unknown Device';
  }, [device]);

  const deviceType = useMemo((): string => {
    const d = device as Device & Record<string, unknown>;
    const type = d.deviceType || d.productName;
    return typeof type === 'string' ? type : '';
  }, [device]);

  const productName = useMemo((): string => {
    const d = device as Device & Record<string, unknown>;
    const name = d.productName;
    return typeof name === 'string' ? name : '';
  }, [device]);

  const online = useMemo(() => {
    const onlineValue = (device as Device).online ?? (device as Record<string, unknown>).online;
    return typeof onlineValue === 'number' ? onlineValue === 1 : Boolean(onlineValue);
  }, [device]);

  const family = useMemo(
    () =>
      resolveDeviceFamily({
        sn: deviceId,
        productName: productName || deviceType,
        deviceType,
      }),
    [deviceId, productName, deviceType]
  );

  /** API product/type, else SN-family fallback (e.g. P351 → Delta 3 Plus). */
  const modelLabel = useMemo((): string => {
    if (deviceType) return deviceType;
    if (productName) return productName;
    return deviceFamilyLabel(family) ?? '';
  }, [deviceType, productName, family]);

  const { data: statusData, isLoading, isError, error } = useDeviceStatus(deviceId, true);

  const isPlug = useMemo(() => {
    if (isSmartPlugFamily(family)) return true;
    return Boolean(statusData?.data?.isPlug);
  }, [family, statusData]);

  const statusOk = useMemo(() => {
    if (isError || !statusData?.data) return false;
    if (statusData.source === 'error') return false;
    return true;
  }, [statusData, isError]);

  const netWatts = useMemo(() => {
    if (!statusOk || !statusData?.data) return null;
    const { chargeRate, dischargeRate } = statusData.data;
    if (chargeRate !== undefined && chargeRate > 0) return { label: 'In', value: chargeRate };
    if (dischargeRate !== undefined && dischargeRate > 0) {
      return { label: 'Out', value: dischargeRate };
    }
    if (chargeRate !== undefined || dischargeRate !== undefined) {
      return { label: 'Power', value: chargeRate ?? dischargeRate ?? 0 };
    }
    return null;
  }, [statusData, statusOk]);

  const remainingLabel = useMemo(() => {
    if (!statusOk || !statusData?.data || isPlug) return null;
    const { status, remainingChargeMin, remainingDischargeMin } = statusData.data;
    if (status === 'charging') {
      const t = formatRemainingMinutes(remainingChargeMin);
      return t ? `Full in ${t}` : null;
    }
    if (status === 'discharging') {
      const t = formatRemainingMinutes(remainingDischargeMin);
      return t ? `Empty in ${t}` : null;
    }
    return null;
  }, [statusData, statusOk, isPlug]);

  const plugPowerLabel = useMemo(() => {
    if (!statusOk || !statusData?.data) return null;
    const { plugWatts, switchSta, plugWattsAnomalous } = statusData.data;
    // Known Smart Plug family: never fall back to charge/discharge (those may be
    // unscaled station-path values and caused ~10× UI spikes like 11270 W).
    if (typeof plugWatts !== 'number' && typeof switchSta !== 'boolean') {
      return null;
    }
    const anomalous =
      Boolean(plugWattsAnomalous) ||
      (typeof plugWatts === 'number' && plugWatts > PLUG_POWER_CONFIG.ANOMALY_WATTS);
    return {
      watts: typeof plugWatts === 'number' ? plugWatts : undefined,
      switchSta: typeof switchSta === 'boolean' ? switchSta : undefined,
      anomalous,
    };
  }, [statusData, statusOk]);

  const statusErrorMessage = useMemo(() => {
    const raw =
      error?.message || (isPlug ? 'Power unavailable' : 'Status unavailable');
    return formatDeviceStatusError(raw);
  }, [error, isPlug]);

  /** Avoid repeating Smart Plug when the model line already says it */
  const showPlugKindLabel = useMemo(() => {
    if (!isPlug) return false;
    return !/smart\s*plug/i.test(modelLabel);
  }, [isPlug, modelLabel]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <Link
        to={`/device/${deviceId}`}
        className="block p-6 pb-3"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {String(deviceName)}
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
              {String(deviceId)}
            </p>
            {modelLabel && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {modelLabel}
              </p>
            )}

            <div className="mt-4">
              {isLoading && !statusData && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading status…</p>
              )}
              {(isError || statusData?.source === 'error') && (
                <div className="space-y-1">
                  {showPlugKindLabel && (
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Smart Plug</p>
                  )}
                  <p className="text-sm text-red-600 dark:text-red-400" role="status">
                    {statusErrorMessage}
                  </p>
                </div>
              )}
              {!statusOk && !isLoading && !isError && statusData?.source !== 'error' && isPlug && (
                <div className="space-y-1">
                  {showPlugKindLabel && (
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Smart Plug</p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400">Power unavailable</p>
                </div>
              )}
              {statusOk && statusData?.data && isPlug && (
                <div className="space-y-2">
                  {showPlugKindLabel && (
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Smart Plug</p>
                  )}
                  {plugPowerLabel ? (
                    <>
                      {typeof plugPowerLabel.switchSta === 'boolean' && (
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Switch: {plugPowerLabel.switchSta ? 'On' : 'Off'}
                        </p>
                      )}
                      {typeof plugPowerLabel.watts === 'number' && (
                        <p
                          className={`text-sm ${
                            plugPowerLabel.anomalous
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          Power: {plugPowerLabel.watts} W
                          {plugPowerLabel.anomalous ? ' (anomaly — check scale)' : ''}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Power unavailable</p>
                  )}
                </div>
              )}
              {statusOk && statusData?.data && !isPlug && (
                <div className="space-y-2">
                  <BatteryIndicator level={statusData.data.batteryLevel} size="sm" />
                  {netWatts && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {netWatts.label}: {netWatts.value} W
                    </p>
                  )}
                  {remainingLabel && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{remainingLabel}</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <SourceBadge source={statusData?.source} timestamp={statusData?.timestamp} />
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                Boolean(online)
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {Boolean(online) ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </Link>
      <div className="px-6 pb-4">
        <Link
          to={`/device/${deviceId}?lab=raw`}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Inspect quota
        </Link>
      </div>
    </div>
  );
});
