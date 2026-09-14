/**
 * Format remaining charge/discharge minutes for home-lab UI.
 */

export function formatRemainingMinutes(minutes: number | undefined | null): string | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) {
    return null;
  }
  const m = Math.round(minutes);
  if (m < 60) {
    return `${m}m`;
  }
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) {
    return `${h}h`;
  }
  return `${h}h ${rem}m`;
}
