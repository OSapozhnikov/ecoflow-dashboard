/**
 * Lightweight SVG sparkline / multi-series history chart (no chart lib).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface HistoryPoint {
  ts: number;
  battery_level: number | null;
  charge_w: number | null;
  discharge_w: number | null;
  plug_w: number | null;
}

interface HistoryResponse {
  deviceId: string;
  from: number;
  to: number;
  samples: HistoryPoint[];
}

interface DeviceHistoryChartProps {
  deviceId: string;
  isPlug: boolean;
}

function buildPath(
  points: Array<{ x: number; y: number }>,
  width: number,
  height: number
): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => {
      const x = (p.x / Math.max(points.length - 1, 1)) * width;
      const y = height - p.y * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function DeviceHistoryChart({ deviceId, isPlug }: DeviceHistoryChartProps) {
  const to = Date.now();
  const from = to - 30 * 24 * 60 * 60 * 1000;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['history', deviceId, from, to],
    queryFn: () =>
      api.get<HistoryResponse>(
        `/api/devices/${deviceId}/history?from=${from}&to=${to}`
      ),
    refetchInterval: 60_000,
  });

  const { data: monthly } = useQuery({
    queryKey: ['history-monthly', deviceId],
    queryFn: () =>
      api.get<{
        months: Array<{
          month: string;
          avg_soc: number | null;
          energy_in_wh: number | null;
          energy_out_wh: number | null;
        }>;
      }>(`/api/devices/${deviceId}/history/monthly`),
    refetchInterval: 300_000,
  });

  const chart = useMemo(() => {
    const samples = data?.samples ?? [];
    if (samples.length < 2) return null;

    const width = 600;
    const height = 160;
    const values = samples.map((s) => {
      if (isPlug) return s.plug_w ?? 0;
      return s.battery_level ?? 0;
    });
    const max = Math.max(...values, isPlug ? 1 : 100);
    const min = isPlug ? 0 : 0;
    const span = Math.max(max - min, 1);
    const pts = values.map((v, i) => ({
      x: i,
      y: (v - min) / span,
    }));

    return {
      width,
      height,
      path: buildPath(pts, width, height),
      latest: values[values.length - 1],
      label: isPlug ? 'Plug W (30d)' : 'SOC % (30d)',
      sampleCount: samples.length,
    };
  }, [data, isPlug]);

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
        History (30 days)
      </h2>
      {isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading history…</p>
      )}
      {isError && (
        <p className="text-sm text-gray-500 dark:text-gray-400">History unavailable</p>
      )}
      {!isLoading && chart && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {chart.label} · {chart.sampleCount} samples · latest {chart.latest}
            {isPlug ? ' W' : '%'}
          </p>
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            className="w-full h-40 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
            role="img"
            aria-label={chart.label}
          >
            <path
              d={chart.path}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-blue-600 dark:text-blue-400"
            />
          </svg>
        </div>
      )}
      {!isLoading && !chart && !isError && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No samples yet — history fills as status updates arrive.
        </p>
      )}

      {monthly && monthly.months.length > 0 && (
        <div className="mt-6">
          <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Monthly summary
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left text-gray-700 dark:text-gray-300">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4">Month</th>
                  <th className="py-2 pr-4">Avg SOC</th>
                  <th className="py-2 pr-4">In Wh (est.)</th>
                  <th className="py-2 pr-4">Out Wh (est.)</th>
                </tr>
              </thead>
              <tbody>
                {monthly.months.map((m) => (
                  <tr key={m.month} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-4 font-mono">{m.month}</td>
                    <td className="py-2 pr-4">
                      {m.avg_soc != null ? `${m.avg_soc.toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-2 pr-4">
                      {m.energy_in_wh != null ? m.energy_in_wh.toFixed(0) : '—'}
                    </td>
                    <td className="py-2 pr-4">
                      {m.energy_out_wh != null ? m.energy_out_wh.toFixed(0) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Energy is estimated from W × Δt (trapezoid); treat as approximate.
          </p>
        </div>
      )}
    </section>
  );
}
