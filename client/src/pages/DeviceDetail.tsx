/**
 * Device Detail Page
 */

import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { BatteryIndicator } from '../components/BatteryIndicator';
import { ChargeRate } from '../components/ChargeRate';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import type { DeviceListResponse } from '../types/ecoflow';

export function DeviceDetail() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const queryClient = useQueryClient();
  const { data, isLoading, error, isError } = useDeviceStatus(deviceId || '', !!deviceId);

  const deviceName = useMemo((): string => {
    if (!deviceId) return 'Device';

    const list = queryClient.getQueryData<DeviceListResponse>(['devices']);
    const match = list?.devices?.find(
      (d) => d.sn === deviceId || d.deviceId === deviceId || d.deviceSn === deviceId
    );
    if (match?.deviceName) return match.deviceName;

    return deviceId;
  }, [deviceId, queryClient, data]);

  const statusUnavailable =
    isError ||
    data?.source === 'error' ||
    (!isLoading && (!data || !data.data));

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
            <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mb-6">
              {deviceId}
            </p>
          )}

          {isLoading && <LoadingSpinner />}

          {statusUnavailable && !isLoading && (
            <div className="mb-6">
              <ErrorMessage
                message={
                  error?.message ||
                  (data?.source === 'error'
                    ? 'Device status unavailable'
                    : 'Device status not available')
                }
              />
            </div>
          )}

          {!isLoading && data?.data && data.source !== 'error' && (
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
