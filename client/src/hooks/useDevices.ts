/**
 * React Query hook for devices
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { DeviceListResponse } from '../types/ecoflow';
import { REFETCH_INTERVALS } from '../constants';

export function useDevices() {
  return useQuery<DeviceListResponse, Error>({
    queryKey: ['devices'],
    queryFn: () => apiClient.getDevices(),
    refetchInterval: REFETCH_INTERVALS.DEVICES,
  });
}

