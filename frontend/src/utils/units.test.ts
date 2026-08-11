import { describe, it, expect } from 'vitest';
import { kgToLbs, lbsToKg, cmToFtIn, ftInToCm, roundTo } from './units';

describe('units', () => {
  it('converts kg to lbs and back', () => {
    expect(roundTo(kgToLbs(70), 1)).toBe(154.3);
    expect(roundTo(lbsToKg(154.3), 1)).toBe(70);
  });

  it('converts cm to feet/inches', () => {
    expect(cmToFtIn(175)).toEqual({ feet: 5, inches: 9 });
    expect(cmToFtIn(180)).toEqual({ feet: 5, inches: 11 });
  });

  it('carries a rounded 12 inches into the next foot', () => {
    // 60 inches exactly = 5'0", but a value that rounds up to 12" within foot 4
    // must roll over rather than showing "4'12"".
    const result = cmToFtIn(152.4); // exactly 60 inches
    expect(result).toEqual({ feet: 5, inches: 0 });
  });

  it('converts feet/inches to cm and back', () => {
    expect(roundTo(ftInToCm(5, 9), 0)).toBe(175);
  });

  it('roundTo rounds to the given decimal places', () => {
    expect(roundTo(22.849, 1)).toBe(22.8);
    expect(roundTo(22.85, 1)).toBe(22.9);
  });
});
