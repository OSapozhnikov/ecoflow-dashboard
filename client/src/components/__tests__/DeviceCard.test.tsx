/**
 * Unit tests for DeviceCard component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeviceCard } from '../DeviceCard';
import { useDeviceStatus } from '../../hooks/useDeviceStatus';

// Mock useDeviceStatus hook
vi.mock('../../hooks/useDeviceStatus', () => ({
  useDeviceStatus: vi.fn(),
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
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </BrowserRouter>
  );
};

describe('DeviceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeviceStatus).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      wsConnected: false,
      usingMQTT: false,
    } as ReturnType<typeof useDeviceStatus>);
  });

  it('should render device name', () => {
    const device = {
      sn: 'ABC123',
      deviceName: 'Test Device',
      deviceType: 'Delta Pro',
      online: 1,
    };

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    expect(screen.getByText('Test Device')).toBeInTheDocument();
  });

  it('should render device ID', () => {
    const device = {
      sn: 'ABC123',
      deviceName: 'Test Device',
      online: 1,
    };

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  it('should render device type when available', () => {
    const device = {
      sn: 'ABC123',
      deviceName: 'Test Device',
      deviceType: 'Delta Pro',
      online: 1,
    };

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    expect(screen.getByText('Delta Pro')).toBeInTheDocument();
  });

  it('should show online status', () => {
    const device = {
      sn: 'ABC123',
      deviceName: 'Test Device',
      online: 1,
    };

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('should show offline status', () => {
    const device = {
      sn: 'ABC123',
      deviceName: 'Test Device',
      online: 0,
    };

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('should show MQTT active badge when MQTT data is recent', () => {
    const device = {
      sn: 'ABC123',
      deviceName: 'Test Device',
      online: 1,
    };

    vi.mocked(useDeviceStatus).mockReturnValue({
      data: {
        deviceId: 'ABC123',
        data: {
          deviceId: 'ABC123',
          batteryLevel: 85,
          status: 'charging',
          timestamp: Date.now(),
        },
        source: 'mqtt',
        timestamp: Date.now(),
      },
      isLoading: false,
      isError: false,
      error: null,
      wsConnected: true,
      usingMQTT: true,
    } as ReturnType<typeof useDeviceStatus>);

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    expect(screen.getByText('MQTT')).toBeInTheDocument();
  });

  it('should handle missing device name', () => {
    const device = {
      sn: 'ABC123',
      online: 1,
    };

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    expect(screen.getByText('Unknown Device')).toBeInTheDocument();
  });

  it('should create correct link to device detail page', () => {
    const device = {
      sn: 'ABC123',
      deviceName: 'Test Device',
      online: 1,
    };

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/device/ABC123');
  });
});

