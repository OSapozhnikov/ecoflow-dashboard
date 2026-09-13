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
  const devices = data?.devices || [];
  const hasDevices = Array.isArray(devices) && devices.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {hasDevices ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => (
              <DeviceCard key={device.sn} device={device} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              {data ? 'No devices found' : 'Loading devices...'}
            </p>
            {import.meta.env.DEV && data && (
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

