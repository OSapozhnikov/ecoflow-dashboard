/**
 * Unit tests for DeviceCard component
 */

import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
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

  it('links Inspect quota to lab=raw on device detail', () => {
    const device = {
      sn: 'ABC123',
      deviceName: 'Test Device',
      online: 1,
    };

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    const inspect = screen.getByRole('link', { name: 'Inspect quota' });
    expect(inspect).toHaveAttribute('href', '/device/ABC123?lab=raw');
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

    expect(screen.getByText('MQTT live')).toBeInTheDocument();
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

    const link = screen.getByRole('link', { name: /Test Device/ });
    expect(link).toHaveAttribute('href', '/device/ABC123');
  });

  it('should show battery and watts when status is ok', () => {
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
          batteryLevel: 72,
          chargeRate: 120,
          dischargeRate: 0,
          status: 'charging',
          timestamp: Date.now(),
        },
        source: 'rest',
        timestamp: Date.now(),
      },
      isLoading: false,
      isError: false,
      error: null,
      wsConnected: false,
      usingMQTT: false,
    } as ReturnType<typeof useDeviceStatus>);

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText(/In:\s*120\s*W/)).toBeInTheDocument();
  });

  it('should show unavailable when status query fails', () => {
    const device = {
      sn: 'ABC123',
      deviceName: 'Test Device',
      online: 1,
    };

    vi.mocked(useDeviceStatus).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch device status'),
      wsConnected: false,
      usingMQTT: false,
    } as ReturnType<typeof useDeviceStatus>);

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    expect(screen.getByText('Failed to fetch device status')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('should not treat source=error as a real 0% SOC', () => {
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
          batteryLevel: 0,
          status: 'standby',
          timestamp: Date.now(),
        },
        source: 'error',
        timestamp: Date.now(),
      },
      isLoading: false,
      isError: false,
      error: null,
      wsConnected: false,
      usingMQTT: false,
    } as ReturnType<typeof useDeviceStatus>);

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    expect(screen.getByText('Status unavailable')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('shows Smart Plug UX without battery for HW52', () => {
    const device = {
      sn: 'HW52DH596BD4764',
      deviceName: 'Bathroom',
      productName: 'Smart Plug',
      online: 1,
    };

    vi.mocked(useDeviceStatus).mockReturnValue({
      data: {
        deviceId: 'HW52DH596BD4764',
        data: {
          deviceId: 'HW52DH596BD4764',
          batteryLevel: 0,
          status: 'discharging',
          timestamp: Date.now(),
          isPlug: true,
          switchSta: true,
          plugWatts: 42.5,
          volt: 230,
          temp: 26,
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

    expect(screen.getByText('Smart Plug')).toBeInTheDocument();
    expect(screen.getByText(/Switch:\s*On/)).toBeInTheDocument();
    expect(screen.getByText(/Power:\s*42\.5\s*W/)).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('does not fall back to dischargeRate for Smart Plug (avoids 10× scale bugs)', () => {
    const device = {
      sn: 'HW52ZDH59G8D4764',
      deviceName: 'Bathroom',
      productName: 'Smart Plug',
      online: 1,
    };

    vi.mocked(useDeviceStatus).mockReturnValue({
      data: {
        deviceId: 'HW52ZDH59G8D4764',
        data: {
          deviceId: 'HW52ZDH59G8D4764',
          batteryLevel: 0,
          chargeRate: 0,
          dischargeRate: 88,
          status: 'discharging',
          timestamp: Date.now(),
          isPlug: true,
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

    expect(screen.queryByText(/Power:\s*88\s*W/)).not.toBeInTheDocument();
    expect(screen.getByText('Power unavailable')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('shows Smart Plug power unavailable without fake 0% battery', () => {
    const device = {
      sn: 'HW52DH596BD4764',
      deviceName: 'Bathroom',
      productName: 'Smart Plug',
      online: 1,
    };

    vi.mocked(useDeviceStatus).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      wsConnected: false,
      usingMQTT: false,
    } as ReturnType<typeof useDeviceStatus>);

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    expect(screen.getByText('Smart Plug')).toBeInTheDocument();
    expect(screen.getByText('Power unavailable')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('labels Smart Plug from SN when productName is missing', () => {
    const device = {
      sn: 'HW52DH596BD4764',
      deviceName: 'Bathroom',
      online: 1,
    };

    vi.mocked(useDeviceStatus).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      wsConnected: false,
      usingMQTT: false,
    } as ReturnType<typeof useDeviceStatus>);

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    expect(screen.getAllByText('Smart Plug').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Power unavailable')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('keeps battery UI for power stations', () => {
    const device = {
      sn: 'D3M1ZE1A9H990313',
      deviceName: 'Taurus',
      productName: 'DELTA 3 Max Plus',
      online: 1,
    };

    vi.mocked(useDeviceStatus).mockReturnValue({
      data: {
        deviceId: 'D3M1ZE1A9H990313',
        data: {
          deviceId: 'D3M1ZE1A9H990313',
          batteryLevel: 67,
          chargeRate: 120,
          dischargeRate: 0,
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

    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText(/In:\s*120\s*W/)).toBeInTheDocument();
    expect(screen.getByText('DELTA 3 Max Plus')).toBeInTheDocument();
    expect(screen.queryByText('Smart Plug')).not.toBeInTheDocument();
  });

  it('labels Delta 3 Plus from P351 SN when productName is missing', () => {
    const device = {
      sn: 'P351ZEH4PGCC0498',
      deviceName: 'Tau',
      online: 1,
    };

    vi.mocked(useDeviceStatus).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error(
        'Ecoflow rejected quota/all for SN P351ZEH4PGCC0498 with "signature is wrong". ' +
          'This often means the SN is unsupported, offline, or not entitled on this account/region ' +
          '(not a global HMAC failure). Compare logs with a working SN (e.g. Taurus D3M1…). ' +
          'Vendor code: 8521.'
      ),
      wsConnected: false,
      usingMQTT: false,
    } as ReturnType<typeof useDeviceStatus>);

    render(<DeviceCard device={device} />, { wrapper: createWrapper() });

    expect(screen.getByText('Delta 3 Plus')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Status unavailable (unsupported, offline, or not entitled). Vendor code: 8521.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Compare logs with a working SN/)).not.toBeInTheDocument();
  });
});

