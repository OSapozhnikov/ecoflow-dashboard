/**
 * Device Detail Page
 */

import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { deviceFamilyLabel, isSmartPlugFamily, resolveDeviceFamily } from '@ecoflow/shared';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { BatteryIndicator } from '../components/BatteryIndicator';
import { ChargeRate } from '../components/ChargeRate';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { formatDeviceStatusError } from '../utils/formatDeviceStatusError';
import type { Device, DeviceListResponse } from '../types/ecoflow';

export function DeviceDetail() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const queryClient = useQueryClient();
  const { data, isLoading, error, isError } = useDeviceStatus(deviceId || '', !!deviceId);

  const listDevice = useMemo((): Device | undefined => {
    if (!deviceId) return undefined;
    const list = queryClient.getQueryData<DeviceListResponse>(['devices']);
    return list?.devices?.find(
      (d) => d.sn === deviceId || d.deviceId === deviceId || d.deviceSn === deviceId
    );
  }, [deviceId, queryClient, data]);

  const deviceName = useMemo((): string => {
    if (listDevice?.deviceName) return listDevice.deviceName;
    return deviceId || 'Device';
  }, [deviceId, listDevice]);

  const family = useMemo(
    () =>
      resolveDeviceFamily({
        sn: deviceId,
        productName: listDevice?.productName,
        deviceType: listDevice?.deviceType,
      }),
    [deviceId, listDevice]
  );

  /** productName / deviceType from list, else SN-family fallback (e.g. P351 → Delta 3 Plus). */
  const modelLabel = useMemo((): string => {
    const fromApi = listDevice?.deviceType || listDevice?.productName;
    if (typeof fromApi === 'string' && fromApi.trim()) return fromApi;
    return deviceFamilyLabel(family) ?? '';
  }, [listDevice, family]);

  const isPlug = useMemo(() => {
    if (isSmartPlugFamily(family)) return true;
    return Boolean(data?.data?.isPlug);
  }, [family, data]);

  const statusUnavailable =
    isError ||
    data?.source === 'error' ||
    (!isLoading && (!data || !data.data));

  const detailErrorMessage = useMemo(() => {
    const fallback = isPlug
      ? 'Power unavailable'
      : data?.source === 'error'
        ? 'Device status unavailable'
        : 'Device status not available';
    return formatDeviceStatusError(error?.message || fallback);
  }, [isPlug, error, data]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            to="/"
            className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {deviceName}
          </h1>
          {deviceId && (
            <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mt-1">
              {deviceId}
            </p>
          )}
          {modelLabel && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{modelLabel}</p>
          )}
          <div className="mb-6" />

          {isLoading && <LoadingSpinner />}

          {statusUnavailable && !isLoading && (
            <div className="mb-6">
              {isPlug ? (
                <div className="space-y-2">
                  {!/smart\s*plug/i.test(modelLabel) && (
                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      Smart Plug
                    </p>
                  )}
                  <ErrorMessage message={detailErrorMessage} />
                </div>
              ) : (
                <ErrorMessage message={detailErrorMessage} />
              )}
            </div>
          )}

          {!isLoading && data?.data && data.source !== 'error' && isPlug && (
            <div className="space-y-6">
              <div>
                {!/smart\s*plug/i.test(modelLabel) && (
                  <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Smart Plug
                  </h2>
                )}
                {(() => {
                  const plugWatts = data.data.plugWatts;
                  const dischargeRate = data.data.dischargeRate;
                  const chargeRate = data.data.chargeRate;
                  const displayWatts =
                    typeof plugWatts === 'number'
                      ? plugWatts
                      : typeof dischargeRate === 'number' && dischargeRate > 0
                        ? dischargeRate
                        : typeof chargeRate === 'number' && chargeRate > 0
                          ? chargeRate
                          : undefined;
                  const hasSwitch = typeof data.data.switchSta === 'boolean';
                  if (!hasSwitch && typeof displayWatts !== 'number') {
                    return (
                      <p className="text-gray-500 dark:text-gray-400">Power unavailable</p>
                    );
                  }
                  return (
                    <div className="space-y-3 text-gray-800 dark:text-gray-200">
                      {hasSwitch && (
                        <p>
                          Switch:{' '}
                          <span className="font-medium">
                            {data.data.switchSta ? 'On' : 'Off'}
                          </span>
                        </p>
                      )}
                      {typeof displayWatts === 'number' && (
                        <p>
                          Power:{' '}
                          <span className="font-medium">{displayWatts} W</span>
                        </p>
                      )}
                      {typeof data.data.volt === 'number' && (
                        <p>
                          Voltage:{' '}
                          <span className="font-medium">{data.data.volt} V</span>
                        </p>
                      )}
                      {typeof data.data.temp === 'number' && (
                        <p>
                          Temperature:{' '}
                          <span className="font-medium">{data.data.temp} °C</span>
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {!isLoading && data?.data && data.source !== 'error' && !isPlug && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  Battery Level
                </h2>
                <BatteryIndicator level={data.data.batteryLevel} size="lg" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  Status
                </h2>
                <StatusBadge status={data.data.status} />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  Charge Rate
                </h2>
                <ChargeRate rate={data.data.chargeRate} />
              </div>

              {data.data.dischargeRate !== undefined && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                    Discharge Rate
                  </h2>
                  <ChargeRate rate={data.data.dischargeRate} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
