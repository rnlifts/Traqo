/**
 * Convert seconds to hours, minutes, seconds components.
 * @param totalSeconds Total seconds (can be null)
 * @returns Object with h, m, s fields (all non-negative integers)
 */
export function secondsToHMS(
  totalSeconds: number | null
): { h: number; m: number; s: number } {
  if (totalSeconds === null || totalSeconds === 0) {
    return { h: 0, m: 0, s: 0 };
  }

  const hours = Math.floor(totalSeconds / 3600);
  const remaining = totalSeconds % 3600;
  const minutes = Math.floor(remaining / 60);
  const seconds = Math.round(remaining % 60);

  return { h: hours, m: minutes, s: seconds };
}

/**
 * Convert hours, minutes, seconds to total seconds.
 * @param h Hours (non-negative number, can be decimal or >60)
 * @param m Minutes (non-negative number, can be decimal or >60)
 * @param s Seconds (non-negative number, can be decimal or >60)
 * @returns Total seconds as integer
 */
export function hmsToSeconds(h: number, m: number, s: number): number {
  const totalSeconds = (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
  return Math.round(totalSeconds);
}
