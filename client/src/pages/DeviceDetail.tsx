/**
 * Device Detail Page
 */

import { useParams, Link } from 'react-router-dom';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { BatteryIndicator } from '../components/BatteryIndicator';
import { ChargeRate } from '../components/ChargeRate';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

export function DeviceDetail() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { data, isLoading, error } = useDeviceStatus(deviceId || '', !!deviceId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <ErrorMessage message={error.message} />
      </div>
    );
  }

  if (!data || !data.data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <ErrorMessage message="Device status not available" />
      </div>
    );
  }

  const status = data.data;

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Device Status
          </h1>

          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Battery Level
              </h2>
              <BatteryIndicator level={status.batteryLevel} size="lg" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Status
              </h2>
              <StatusBadge status={status.status} />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Charge Rate
              </h2>
              <ChargeRate rate={status.chargeRate} />
            </div>

            {status.dischargeRate !== undefined && (
              <div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  Discharge Rate
                </h2>
                <ChargeRate rate={status.dischargeRate} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

