/**
 * Unit tests for useDeviceStatus hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeviceStatus } from '../useDeviceStatus';
import { apiClient } from '../../services/api';
import { websocketClient } from '../../services/websocket';

// Mock API client
vi.mock('../../services/api', () => ({
  apiClient: {
    getDeviceStatus: vi.fn(),
  },
}));

// Mock WebSocket client
vi.mock('../../services/websocket', () => ({
  websocketClient: {
    getConnectionStatus: vi.fn(),
    onStatus: vi.fn(),
    onMessage: vi.fn(),
  },
}));

// Mock constants
vi.mock('../../constants', () => ({
  REFETCH_INTERVALS: {
    DEVICE_STATUS: 5000,
    DEVICE_STATUS_WS: 10000,
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useDeviceStatus', () => {
  let unsubscribeStatus: () => void;
  let unsubscribeMessage: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    
    unsubscribeStatus = vi.fn();
    unsubscribeMessage = vi.fn();

    vi.mocked(websocketClient.getConnectionStatus).mockReturnValue({
      connected: false,
      usingMQTT: false,
      status: 'disconnected',
    });

    vi.mocked(websocketClient.onStatus).mockReturnValue(unsubscribeStatus);
    vi.mocked(websocketClient.onMessage).mockReturnValue(unsubscribeMessage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch device status successfully', async () => {
    const mockStatus = {
      deviceId: 'ABC123',
      data: {
        deviceId: 'ABC123',
        batteryLevel: 85,
        chargeRate: 100,
        dischargeRate: 0,
        status: 'charging',
        timestamp: Date.now(),
      },
      source: 'rest',
    };

    vi.mocked(apiClient.getDeviceStatus).mockResolvedValue(mockStatus);

    const { result } = renderHook(() => useDeviceStatus('ABC123', true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockStatus);
    expect(apiClient.getDeviceStatus).toHaveBeenCalledWith('ABC123');
  });

  it('should handle errors', async () => {
    const error = new Error('Failed to fetch device status');
    vi.mocked(apiClient.getDeviceStatus).mockRejectedValue(error);

    const { result } = renderHook(() => useDeviceStatus('ABC123', true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error);
  });

  it('should subscribe to WebSocket status updates', () => {
    renderHook(() => useDeviceStatus('ABC123', true), {
      wrapper: createWrapper(),
    });

    expect(websocketClient.onStatus).toHaveBeenCalled();
    expect(websocketClient.onMessage).toHaveBeenCalled();
  });

  it('should unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useDeviceStatus('ABC123', true), {
      wrapper: createWrapper(),
    });

    unmount();

    expect(unsubscribeStatus).toHaveBeenCalled();
    expect(unsubscribeMessage).toHaveBeenCalled();
  });

  it('should not fetch when disabled', () => {
    renderHook(() => useDeviceStatus('ABC123', false), {
      wrapper: createWrapper(),
    });

    expect(apiClient.getDeviceStatus).not.toHaveBeenCalled();
  });

  it('should not fetch when deviceId is empty', () => {
    renderHook(() => useDeviceStatus('', true), {
      wrapper: createWrapper(),
    });

    expect(apiClient.getDeviceStatus).not.toHaveBeenCalled();
  });

  it('should update connection status from WebSocket', () => {
    vi.mocked(websocketClient.getConnectionStatus).mockReturnValue({
      connected: true,
      usingMQTT: true,
      status: 'connected',
    });

    const { result } = renderHook(() => useDeviceStatus('ABC123', true), {
      wrapper: createWrapper(),
    });

    expect(result.current.usingMQTT).toBe(true);
  });

  it('should handle WebSocket status updates', async () => {
    const mockStatus = {
      deviceId: 'ABC123',
      data: {
        deviceId: 'ABC123',
        batteryLevel: 85,
        status: 'charging',
        timestamp: Date.now(),
      },
      source: 'rest',
    };

    vi.mocked(apiClient.getDeviceStatus).mockResolvedValue(mockStatus);

    let statusHandler: ((update: unknown) => void) | undefined;
    vi.mocked(websocketClient.onStatus).mockImplementation((handler) => {
      statusHandler = handler as (update: unknown) => void;
      return unsubscribeStatus;
    });

    const { result } = renderHook(() => useDeviceStatus('ABC123', true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Simulate WebSocket status update
    if (statusHandler) {
      const wsUpdate = {
        deviceSn: 'ABC123',
        status: {
          deviceId: 'ABC123',
          batteryLevel: 90,
          status: 'charging',
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
        source: 'mqtt' as const,
      };

      statusHandler(wsUpdate);

      await waitFor(() => {
        expect(result.current.data?.data.batteryLevel).toBe(90);
      });
    }
  });
});

