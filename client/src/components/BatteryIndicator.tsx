/**
 * Battery Indicator Component
 */

import { memo, useMemo } from 'react';

interface BatteryIndicatorProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
}

export const BatteryIndicator = memo(function BatteryIndicator({ level, size = 'md' }: BatteryIndicatorProps) {
  const sizeClasses = useMemo(() => ({
    sm: 'w-16 h-8',
    md: 'w-24 h-12',
    lg: 'w-32 h-16',
  }), []);

  const colorClass = useMemo(() => {
    if (level > 50) return 'bg-green-500';
    if (level > 20) return 'bg-yellow-500';
    return 'bg-red-500';
  }, [level]);

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} border-2 border-gray-300 dark:border-gray-600 rounded relative overflow-hidden`}>
        <div
          className={`h-full ${colorClass} transition-all duration-500`}
          style={{ width: `${level}%` }}
        />
      </div>
      <span className="text-lg font-semibold text-gray-900 dark:text-white">
        {level}%
      </span>
    </div>
  );
});

