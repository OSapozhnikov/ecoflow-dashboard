/**
 * Device Card Component
 */

import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import type { Device } from '../types/ecoflow';

interface DeviceCardProps {
  device: Device | Record<string, unknown>;
}

export const DeviceCard = memo(function DeviceCard({ device }: DeviceCardProps) {
  // Safe property access with fallbacks - memoized to avoid recalculation
  const deviceId = useMemo(() => {
    return (device as Device).sn || (device as Device).deviceSn || (device as Device).deviceId || (device as Record<string, unknown>).sn || '';
  }, [device]);

  const deviceName = useMemo(() => {
    return (device as Device).deviceName || (device as Record<string, unknown>).deviceName || (device as Record<string, unknown>).name || 'Unknown Device';
  }, [device]);

  const deviceType = useMemo(() => {
    return (device as Device).deviceType || (device as Device).productName || (device as Record<string, unknown>).deviceType || (device as Record<string, unknown>).productName || '';
  }, [device]);

  const online = useMemo(() => {
    const onlineValue = (device as Device).online ?? (device as Record<string, unknown>).online;
    return typeof onlineValue === 'number' ? onlineValue === 1 : Boolean(onlineValue);
  }, [device]);

  // Get device status to check MQTT data reception
  const { data: statusData } = useDeviceStatus(deviceId, true);
  
  // Check if MQTT data was received within the last minute - memoized
  const isMQTTActive = useMemo(() => {
    if (!statusData) return false;
    
    const source = statusData.source;
    const timestamp = statusData.timestamp;
    
    if (source !== 'mqtt' || !timestamp) return false;
    
    const oneMinuteAgo = Date.now() - 60 * 1000;
    return timestamp >= oneMinuteAgo;
  }, [statusData]);

  return (
    <Link
      to={`/device/${deviceId}`}
      className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {String(deviceName)}
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
            {String(deviceId)}
          </p>
          {deviceType && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {String(deviceType)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isMQTTActive
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            MQTT
          </span>
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
  );
});

