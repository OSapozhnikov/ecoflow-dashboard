/**
 * Status source badge: MQTT live / MQTT stale / REST
 */

import { resolveSourceDisplay, sourceDisplayLabel } from '../utils/statusSource';
import type { DataSource } from '@ecoflow/shared';

interface SourceBadgeProps {
  source?: DataSource | string;
  timestamp?: number;
}

export function SourceBadge({ source, timestamp }: SourceBadgeProps) {
  const display = resolveSourceDisplay(source, timestamp);
  const live = display === 'mqtt-live';
  const rest = display === 'rest';
  const paused = display === 'paused';

  const className = live
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    : rest
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      : paused
        ? 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${className}`}>
      {sourceDisplayLabel(display)}
    </span>
  );
}
