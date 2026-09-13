/**
 * Unit tests for DeviceDetail page
 */

import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeviceDetail } from '../DeviceDetail';
import { useDeviceStatus } from '../../hooks/useDeviceStatus';
import type { DeviceListResponse } from '../../types/ecoflow';

vi.mock('../../hooks/useDeviceStatus', () => ({
  useDeviceStatus: vi.fn(),
}));

function renderDetail(deviceId: string, devices?: DeviceListResponse['devices']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  if (devices) {
    queryClient.setQueryData<DeviceListResponse>(['devices'], { devices });
  }

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/device/${deviceId}`]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/device/:deviceId" element={children} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );

  return render(<DeviceDetail />, { wrapper });
}

describe('DeviceDetail', () => {
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

  it('shows productName from the devices list under the SN', () => {
    vi.mocked(useDeviceStatus).mockReturnValue({
      data: {
        deviceId: 'D3M1ZE1A9H990313',
        data: {
          deviceId: 'D3M1ZE1A9H990313',
          batteryLevel: 88,
          chargeRate: 224,
          dischargeRate: 218,
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

    renderDetail('D3M1ZE1A9H990313', [
      {
        sn: 'D3M1ZE1A9H990313',
        deviceName: 'Taurus',
        productName: 'DELTA 3 Max Plus',
        online: 1,
      },
    ]);

    expect(screen.getByRole('heading', { name: 'Taurus' })).toBeInTheDocument();
    expect(screen.getByText('D3M1ZE1A9H990313')).toBeInTheDocument();
    expect(screen.getByText('DELTA 3 Max Plus')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
  });

  it('falls back to Delta 3 Plus from P351 SN when productName is missing', () => {
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

    renderDetail('P351ZEH4PGCC0498', [
      {
        sn: 'P351ZEH4PGCC0498',
        deviceName: 'Tau',
        online: 1,
      },
    ]);

    expect(screen.getByRole('heading', { name: 'Tau' })).toBeInTheDocument();
    expect(screen.getByText('Delta 3 Plus')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Status unavailable (unsupported, offline, or not entitled). Vendor code: 8521.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Compare logs with a working SN/)).not.toBeInTheDocument();
  });
});
