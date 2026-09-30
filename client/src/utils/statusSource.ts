/**
 * Derive display label for status source + freshness.
 */

import { STATUS_FRESHNESS_MS, type DataSource } from '@ecoflow/shared';

export type SourceDisplay = 'mqtt-live' | 'mqtt-stale' | 'rest' | 'paused' | 'unknown';

export function resolveSourceDisplay(
  source: DataSource | string | undefined,
  timestamp: number | undefined,
  now = Date.now()
): SourceDisplay {
  if (source === 'paused') return 'paused';
  if (source === 'rest') return 'rest';
  if (source === 'mqtt') {
    if (typeof timestamp === 'number' && now - timestamp <= STATUS_FRESHNESS_MS.MQTT_LIVE) {
      return 'mqtt-live';
    }
    return 'mqtt-stale';
  }
  return 'unknown';
}

export function sourceDisplayLabel(display: SourceDisplay): string {
  switch (display) {
    case 'mqtt-live':
      return 'MQTT live';
    case 'mqtt-stale':
      return 'MQTT stale';
    case 'rest':
      return 'REST';
    case 'paused':
      return 'Paused';
    default:
      return '—';
  }
}
