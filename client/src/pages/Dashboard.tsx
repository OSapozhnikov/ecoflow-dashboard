/**
 * Dashboard Page — fleet grid + location filter + empty/onboarding states
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDevices } from '../hooks/useDevices';
import { DeviceCard } from '../components/DeviceCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { NetworkError } from '../components/NetworkError';
import { api } from '../services/api';

interface LocationsFile {
  locations: Array<{ id: string; name: string; deviceIds: string[] }>;
}

interface ConnectionStatus {
  connected: boolean;
  usingMQTT: boolean;
  usingREST: boolean;
  subscribedDevices: string[];
}

interface SettingsSummary {
  disabledDeviceIds?: string[];
}

export function Dashboard() {
  const { data, isLoading, error } = useDevices();
  const [locationId, setLocationId] = useState<string>('all');

  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get<LocationsFile>('/api/locations'),
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsSummary>('/api/settings'),
  });

  const { data: connection } = useQuery({
    queryKey: ['connection-status'],
    queryFn: () => api.get<ConnectionStatus>('/api/devices/connection-status'),
    refetchInterval: 60_000,
  });

  const devices = data?.devices || [];
  const locations = locationsData?.locations ?? [];
  const disabledSet = useMemo(
    () => new Set(settings?.disabledDeviceIds ?? []),
    [settings]
  );

  const monitoredDevices = useMemo(
    () => devices.filter((d) => !disabledSet.has(d.sn)),
    [devices, disabledSet]
  );

  const filtered = useMemo(() => {
    if (locationId === 'all') return monitoredDevices;
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return monitoredDevices;
    const set = new Set(loc.deviceIds);
    return monitoredDevices.filter((d) => set.has(d.sn));
  }, [monitoredDevices, locations, locationId]);

  const health = useMemo(() => {
    const total = monitoredDevices.length;
    const online = monitoredDevices.filter((d) =>
      typeof d.online === 'number' ? d.online === 1 : Boolean(d.online)
    ).length;
    return {
      total,
      online,
      mqtt: connection?.usingMQTT ?? false,
      paused: disabledSet.size,
    };
  }, [monitoredDevices, connection, disabledSet]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    const isNetworkError =
      error.message.includes('Cannot connect') ||
      error.message.includes('Network Error') ||
      error.message.includes('ECONNREFUSED');

    const looksLikeConfig =
      /ECOFLOW_|access.?key|secret.?key|configuration/i.test(error.message);

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        {isNetworkError ? (
          <NetworkError message={error.message} />
        ) : looksLikeConfig ? (
          <div className="max-w-xl mx-auto space-y-3">
            <ErrorMessage message={error.message} />
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Set <code className="font-mono">ECOFLOW_ACCESS_KEY</code> /{' '}
              <code className="font-mono">ECOFLOW_SECRET_KEY</code> in{' '}
              <code className="font-mono">.env</code>, then restart the server. See README
              Quick start.
            </p>
          </div>
        ) : (
          <ErrorMessage message={error.message} />
        )}
      </div>
    );
  }

  const hasDevices = Array.isArray(devices) && devices.length > 0;
  const allPaused = hasDevices && monitoredDevices.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Fleet: {health.online}/{health.total} online
            {health.paused > 0 && (
              <span className="ml-2 text-amber-700 dark:text-amber-300">
                · {health.paused} paused
              </span>
            )}
            {connection && (
              <span className="ml-3">
                · {health.mqtt ? 'MQTT connected' : 'REST / MQTT down'}
              </span>
            )}
          </div>
          {locations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLocationId('all')}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  locationId === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}
              >
                All
              </button>
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setLocationId(loc.id)}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    locationId === loc.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {loc.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {hasDevices ? (
          allPaused ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">
              All devices are paused. Resume them under Settings.
            </p>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((device) => (
                <DeviceCard key={device.sn} device={device} />
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">
              No devices in this location. Assign devices under Settings.
            </p>
          )
        ) : (
          <div className="text-center py-12 space-y-3 max-w-lg mx-auto">
            <p className="text-gray-500 dark:text-gray-400 text-lg">No devices found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Bind devices in the Ecoflow app to the same account as your Open API keys.
              Enable MQTT in <code className="font-mono">.env</code> for live updates. Drop
              new device contracts into <code className="font-mono">data/contracts/</code>.
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
