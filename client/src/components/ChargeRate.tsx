/**
 * Charge Rate Component
 */

import { memo } from 'react';

interface ChargeRateProps {
  rate?: number;
  unit?: string;
}

export const ChargeRate = memo(function ChargeRate({ rate, unit = 'W' }: ChargeRateProps) {
  if (rate === undefined || rate === null) {
    return <span className="text-gray-500 dark:text-gray-400">N/A</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-bold text-gray-900 dark:text-white">
        {rate}
      </span>
      <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>
    </div>
  );
});

