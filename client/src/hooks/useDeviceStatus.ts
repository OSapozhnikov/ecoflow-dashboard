/**
 * React Query hook for device status
 * Uses WebSocket for real-time updates, falls back to polling if WebSocket unavailable
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { websocketClient, DeviceStatusUpdate } from '../services/websocket';
import type { DeviceStatusResponse } from '../types/ecoflow';
import { REFETCH_INTERVALS } from '../constants';

export function useDeviceStatus(deviceId: string, enabled: boolean = true) {
  const queryClient = useQueryClient();
  const [wsConnected, setWsConnected] = useState(false);

  // Memoize query function to avoid unnecessary re-renders
  const queryFn = useCallback(
    () => apiClient.getDeviceStatus(deviceId),
    [deviceId]
  );

  // Memoize refetch interval function
  const refetchIntervalFn = useCallback(
    () => {
      // If WebSocket is connected, poll every 10 seconds to check MQTT status
      if (wsConnected) {
        return REFETCH_INTERVALS.DEVICE_STATUS_WS;
      }
      // Fallback polling every 5 seconds if WebSocket unavailable
      return REFETCH_INTERVALS.DEVICE_STATUS;
    },
    [wsConnected]
  );

  // React Query for initial fetch and fallback polling
  const query = useQuery<DeviceStatusResponse, Error>({
    queryKey: ['device-status', deviceId],
    queryFn,
    enabled: enabled && !!deviceId,
    // Use longer interval if WebSocket is connected (fallback only)
    refetchInterval: refetchIntervalFn,
  });

  // Memoize WebSocket status update handler
  const handleStatusUpdate = useCallback(
    (update: DeviceStatusUpdate) => {
      // Only process updates for this device
      if (update.deviceSn === deviceId || update.status.deviceId === deviceId) {
        // Update React Query cache with new data
        queryClient.setQueryData<DeviceStatusResponse>(
          ['device-status', deviceId],
          {
            deviceId: update.deviceSn,
            data: update.status,
            source: update.source,
            timestamp: update.timestamp,
          }
        );
      }
    },
    [deviceId, queryClient]
  );

  // Memoize connection status handler
  const handleConnectionMessage = useCallback((message: { type: string; data?: unknown }) => {
    if (message.type === 'connection') {
      const data = message.data as { status?: string; usingMQTT?: boolean };
      if (data.status === 'connected') {
        setWsConnected(true);
      } else if (data.status === 'disconnected' || data.status === 'fallback') {
        setWsConnected(false);
      }
    }
  }, []);

  // Subscribe to WebSocket status updates
  useEffect(() => {
    if (!enabled || !deviceId) {
      return;
    }

    // Check WebSocket connection status
    const wsStatus = websocketClient.getConnectionStatus();
    setWsConnected(wsStatus.connected);

    // Subscribe to status updates from WebSocket
    const unsubscribe = websocketClient.onStatus(handleStatusUpdate);

    // Subscribe to connection status changes
    const unsubscribeConnection = websocketClient.onMessage(handleConnectionMessage);

    // Cleanup function - properly unsubscribe
    return () => {
      unsubscribe();
      unsubscribeConnection();
    };
  }, [deviceId, enabled, handleStatusUpdate, handleConnectionMessage]);

  return {
    ...query,
    wsConnected,
    usingMQTT: websocketClient.getConnectionStatus().usingMQTT,
  };
}

