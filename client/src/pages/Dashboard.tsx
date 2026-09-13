/**
 * Dashboard Page
 */

import { useDevices } from '../hooks/useDevices';
import { DeviceCard } from '../components/DeviceCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { NetworkError } from '../components/NetworkError';

export function Dashboard() {
  const { data, isLoading, error } = useDevices();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    const isNetworkError = error.message.includes('Cannot connect') || 
                          error.message.includes('Network Error') ||
                          error.message.includes('ECONNREFUSED');
    
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        {isNetworkError ? (
          <NetworkError message={error.message} />
        ) : (
          <ErrorMessage message={error.message} />
        )}
      </div>
    );
  }

  // Safe check for data structure
  const devices = data?.devices || data?.data?.devices || [];
  const hasDevices = Array.isArray(devices) && devices.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Ecoflow Delta 3 Monitor
        </h1>
        
        {hasDevices ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => (
              <DeviceCard key={device.deviceId || device.deviceSn || device.sn} device={device} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              {data ? 'No devices found' : 'Loading devices...'}
            </p>
            {process.env.NODE_ENV === 'development' && data && (
              <pre className="mt-4 text-xs text-left bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

