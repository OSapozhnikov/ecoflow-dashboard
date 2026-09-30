/**
 * Device Detail Page — status, diagnostics, history charts
 */

import { useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deviceFamilyLabel,
  isSmartPlugFamily,
  PLUG_POWER_CONFIG,
  resolveDeviceFamily,
} from '@ecoflow/shared';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import { BatteryIndicator } from '../components/BatteryIndicator';
import { ChargeRate } from '../components/ChargeRate';
import { StatusBadge } from '../components/StatusBadge';
import { SourceBadge } from '../components/SourceBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { DeviceHistoryChart } from '../components/DeviceHistoryChart';
import { RawQuotaLab } from '../components/RawQuotaLab';
import { StationPortsLimits } from '../components/StationPortsLimits';
import { formatDeviceStatusError } from '../utils/formatDeviceStatusError';
import { formatRemainingMinutes } from '../utils/formatRemainingTime';
import { formatRunTimeHours } from '../utils/formatRunTimeHours';
import { api } from '../services/api';
import type { Device, DeviceListResponse } from '../types/ecoflow';

interface DiagnosticsPayload {
  deviceId: string;
  inDeviceList: boolean;
  online?: boolean;
  productName?: string;
  deviceType?: string;
  family?: string;
  monitoringEnabled?: boolean;
  mqtt: {
    enabled: boolean;
    connected: boolean;
    subscribed: boolean;
    lastMqttTimestamp: number | null;
    hasCachedStatus: boolean;
  };
  status: {
    source?: string;
    timestamp?: number;
    lastRestCode?: string | number | null;
    lastError?: string | null;
  };
}

interface SettingsSummary {
  disabledDeviceIds?: string[];
}

export function DeviceDetail() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [searchParams] = useSearchParams();
  const labRaw = searchParams.get('lab') === 'raw';
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsSummary>('/api/settings'),
  });

  const isPaused = Boolean(
    deviceId && (settings?.disabledDeviceIds ?? []).includes(deviceId)
  );

  const { data, isLoading, error, isError } = useDeviceStatus(
    deviceId || '',
    !!deviceId && !isPaused
  );

  const monitoringMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.put<{ deviceId: string; enabled: boolean }>(
        `/api/devices/${deviceId}/monitoring`,
        { enabled }
      ),
    onMutate: async (enabled) => {
      if (!deviceId) return;
      await queryClient.cancelQueries({ queryKey: ['settings'] });
      const previous = queryClient.getQueryData<SettingsSummary>(['settings']);
      const currentIds = previous?.disabledDeviceIds ?? [];
      const nextIds = enabled
        ? currentIds.filter((id) => id !== deviceId)
        : currentIds.includes(deviceId)
          ? currentIds
          : [...currentIds, deviceId];
      queryClient.setQueryData<SettingsSummary>(['settings'], {
        ...previous,
        disabledDeviceIds: nextIds,
      });
      return { previous };
    },
    onError: (_err, _enabled, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['settings'], ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void queryClient.invalidateQueries({ queryKey: ['diagnostics', deviceId] });
      void queryClient.invalidateQueries({ queryKey: ['device-status', deviceId] });
    },
  });

  const { data: diagnostics } = useQuery({
    queryKey: ['diagnostics', deviceId],
    queryFn: () => api.get<DiagnosticsPayload>(`/api/devices/${deviceId}/diagnostics`),
    enabled: !!deviceId,
    refetchInterval: 60_000,
  });

  const listDevice = useMemo((): Device | undefined => {
    if (!deviceId) return undefined;
    const list = queryClient.getQueryData<DeviceListResponse>(['devices']);
    return list?.devices?.find(
      (d) => d.sn === deviceId || d.deviceId === deviceId || d.deviceSn === deviceId
    );
  }, [deviceId, queryClient, data]);

  const deviceName = useMemo((): string => {
    if (listDevice?.deviceName) return listDevice.deviceName;
    return deviceId || 'Device';
  }, [deviceId, listDevice]);

  const family = useMemo(
    () =>
      resolveDeviceFamily({
        sn: deviceId,
        productName: listDevice?.productName,
        deviceType: listDevice?.deviceType,
      }),
    [deviceId, listDevice]
  );

  /** productName / deviceType from list, else SN-family fallback (e.g. P351 → Delta 3 Plus). */
  const modelLabel = useMemo((): string => {
    const fromApi = listDevice?.deviceType || listDevice?.productName;
    if (typeof fromApi === 'string' && fromApi.trim()) return fromApi;
    return deviceFamilyLabel(family) ?? '';
  }, [listDevice, family]);

  const isPlug = useMemo(() => {
    if (isSmartPlugFamily(family)) return true;
    return Boolean(data?.data?.isPlug);
  }, [family, data]);

  const statusUnavailable =
    !isPaused &&
    (isError ||
      data?.source === 'error' ||
      (!isLoading && (!data || !data.data)));

  const detailErrorMessage = useMemo(() => {
    const fallback = isPlug
      ? 'Power unavailable'
      : data?.source === 'error'
        ? 'Device status unavailable'
        : 'Device status not available';
    return formatDeviceStatusError(error?.message || fallback);
  }, [isPlug, error, data]);

  const remainingLabel = useMemo(() => {
    if (!data?.data || isPlug) return null;
    const { status, remainingChargeMin, remainingDischargeMin } = data.data;
    if (status === 'charging') {
      const t = formatRemainingMinutes(remainingChargeMin);
      return t ? `Full in ${t}` : null;
    }
    if (status === 'discharging') {
      const t = formatRemainingMinutes(remainingDischargeMin);
      return t ? `Empty in ${t}` : null;
    }
    return null;
  }, [data, isPlug]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            to="/"
            className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {deviceName}
            </h1>
            <SourceBadge
              source={isPaused ? 'paused' : data?.source}
              timestamp={data?.timestamp}
            />
          </div>
          {deviceId && (
            <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mt-1">
              {deviceId}
            </p>
          )}
          {modelLabel && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{modelLabel}</p>
          )}
          <div className="mt-4 mb-6">
            <button
              type="button"
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                isPaused
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              disabled={!deviceId || monitoringMutation.isPending}
              onClick={() => monitoringMutation.mutate(isPaused)}
            >
              {isPaused ? 'Resume monitoring' : 'Pause monitoring'}
            </button>
          </div>

          {isPaused && (
            <div
              className="mb-6 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
              role="status"
            >
              Monitoring paused — no MQTT, REST, history, or alerts for this device. It is
              hidden from the dashboard until resumed.
            </div>
          )}

          {isLoading && !isPaused && <LoadingSpinner />}

          {statusUnavailable && !isLoading && (
            <div className="mb-6">
              {isPlug ? (
                <div className="space-y-2">
                  {!/smart\s*plug/i.test(modelLabel) && (
                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      Smart Plug
                    </p>
                  )}
                  <ErrorMessage message={detailErrorMessage} />
                </div>
              ) : (
                <ErrorMessage message={detailErrorMessage} />
              )}
            </div>
          )}

          {!isPaused && !isLoading && data?.data && data.source !== 'error' && isPlug && (
            <div className="space-y-6">
              <div>
                {!/smart\s*plug/i.test(modelLabel) && (
                  <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Smart Plug
                  </h2>
                )}
                {(() => {
                  const plugWatts = data.data.plugWatts;
                  const anomalous =
                    Boolean(data.data.plugWattsAnomalous) ||
                    (typeof plugWatts === 'number' &&
                      plugWatts > PLUG_POWER_CONFIG.ANOMALY_WATTS);
                  const hasSwitch = typeof data.data.switchSta === 'boolean';
                  const hasWatts = typeof plugWatts === 'number';
                  const hasVolt = typeof data.data.volt === 'number';
                  const runTimeLabel = formatRunTimeHours(data.data.runTimeSec);
                  const hasTemp = typeof data.data.temp === 'number';
                  if (!hasSwitch && !hasWatts && !hasVolt && !runTimeLabel && !hasTemp) {
                    return (
                      <p className="text-gray-500 dark:text-gray-400">Power unavailable</p>
                    );
                  }
                  return (
                    <div className="space-y-3 text-gray-800 dark:text-gray-200">
                      {hasSwitch && (
                        <p>
                          Switch:{' '}
                          <span className="font-medium">
                            {data.data.switchSta ? 'On' : 'Off'}
                          </span>
                        </p>
                      )}
                      {hasWatts && (
                        <p className={anomalous ? 'text-amber-700 dark:text-amber-300' : ''}>
                          Power:{' '}
                          <span className="font-medium">{plugWatts} W</span>
                          {anomalous ? ' (anomaly — check scale)' : ''}
                        </p>
                      )}
                      {hasVolt && (
                        <p>
                          Voltage:{' '}
                          <span className="font-medium">{data.data.volt} V</span>
                        </p>
                      )}
                      {runTimeLabel && (
                        <p>
                          Runtime: <span className="font-medium">{runTimeLabel}</span>
                        </p>
                      )}
                      {hasTemp && (
                        <p>
                          Temperature:{' '}
                          <span className="font-medium">{data.data.temp} °C</span>
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {!isPaused && !isLoading && data?.data && data.source !== 'error' && !isPlug && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  Battery Level
                </h2>
                <BatteryIndicator level={data.data.batteryLevel} size="lg" />
                {remainingLabel && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{remainingLabel}</p>
                )}
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  Status
                </h2>
                <StatusBadge status={data.data.status} />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  Charge Rate
                </h2>
                <ChargeRate rate={data.data.chargeRate} />
              </div>

              {data.data.dischargeRate !== undefined && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                    Discharge Rate
                  </h2>
                  <ChargeRate rate={data.data.dischargeRate} />
                </div>
              )}

              <StationPortsLimits ports={data.data.ports} limits={data.data.limits} />
            </div>
          )}

          {deviceId && (
            <div className="mt-10 space-y-8">
              <DeviceHistoryChart deviceId={deviceId} isPlug={isPlug} />

              {diagnostics && (
                <section>
                  <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Diagnostics
                  </h2>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300 font-mono">
                    <div>In device list: {String(diagnostics.inDeviceList)}</div>
                    <div>Online (list): {String(diagnostics.online ?? '—')}</div>
                    <div>Family: {diagnostics.family ?? '—'}</div>
                    <div>
                      Monitoring: {String(diagnostics.monitoringEnabled ?? !isPaused)}
                    </div>
                    <div>MQTT enabled: {String(diagnostics.mqtt.enabled)}</div>
                    <div>MQTT connected: {String(diagnostics.mqtt.connected)}</div>
                    <div>MQTT subscribed: {String(diagnostics.mqtt.subscribed)}</div>
                    <div>
                      Last MQTT:{' '}
                      {diagnostics.mqtt.lastMqttTimestamp
                        ? new Date(diagnostics.mqtt.lastMqttTimestamp).toISOString()
                        : '—'}
                    </div>
                    <div>Cached status: {String(diagnostics.mqtt.hasCachedStatus)}</div>
                    <div>Status source: {diagnostics.status.source ?? '—'}</div>
                    <div>Last REST/error: {diagnostics.status.lastError ?? diagnostics.status.lastRestCode ?? '—'}</div>
                  </dl>
                  {diagnostics.status.lastError && (
                    <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                      If vendor code 8521 persists while the official app works, check Open API
                      entitlement / region for this SN (see docs/TAU_8521_SPIKE.md).
                    </p>
                  )}
                </section>
              )}

              <RawQuotaLab deviceId={deviceId} autoOpen={labRaw} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
