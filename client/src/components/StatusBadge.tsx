/**
 * Status Badge Component
 */

import { memo, useMemo } from 'react';

type Status = 'charging' | 'discharging' | 'standby';

interface StatusBadgeProps {
  status: Status;
}

export const StatusBadge = memo(function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig = useMemo(() => ({
    charging: {
      label: 'Charging',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    discharging: {
      label: 'Discharging',
      className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    },
    standby: {
      label: 'Standby',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    },
  }), []);

  const config = useMemo(() => statusConfig[status], [statusConfig, status]);

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
});

