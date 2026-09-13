/**
 * Unit tests for useDevices hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDevices } from '../useDevices';
import { apiClient } from '../../services/api';

// Mock API client
vi.mock('../../services/api', () => ({
  apiClient: {
    getDevices: vi.fn(),
  },
}));

// Mock constants
vi.mock('../../constants', () => ({
  REFETCH_INTERVALS: {
    DEVICES: 30000,
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

describe('useDevices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch devices successfully', async () => {
    const mockDevices = {
      devices: [
        {
          sn: 'ABC123',
          deviceName: 'Test Device',
          deviceType: 'Delta Pro',
          online: 1,
        },
      ],
      total: 1,
    };

    vi.mocked(apiClient.getDevices).mockResolvedValue(mockDevices);

    const { result } = renderHook(() => useDevices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockDevices);
    expect(apiClient.getDevices).toHaveBeenCalledTimes(1);
  });

  it('should handle errors', async () => {
    const error = new Error('Failed to fetch devices');
    vi.mocked(apiClient.getDevices).mockRejectedValue(error);

    const { result } = renderHook(() => useDevices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error);
  });

  it('should handle loading state', () => {
    vi.mocked(apiClient.getDevices).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() => useDevices(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should handle empty devices list', async () => {
    const mockDevices = {
      devices: [],
      total: 0,
    };

    vi.mocked(apiClient.getDevices).mockResolvedValue(mockDevices);

    const { result } = renderHook(() => useDevices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.devices).toEqual([]);
    expect(result.current.data?.total).toBe(0);
  });
});

