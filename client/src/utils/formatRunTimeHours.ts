/**
 * Format vendor Smart Plug runTime (seconds) as hours for Device Detail.
 * Example: 80946 → "22.5 h"
 */

export function formatRunTimeHours(runTimeSec: number | undefined | null): string | null {
  if (typeof runTimeSec !== 'number' || !Number.isFinite(runTimeSec) || runTimeSec < 0) {
    return null;
  }
  const hours = Math.round((runTimeSec / 3600) * 10) / 10;
  return `${hours} h`;
}
