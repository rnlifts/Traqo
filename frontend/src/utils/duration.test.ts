import { describe, it, expect } from 'vitest';
import { secondsToHMS, hmsToSeconds } from './duration';

describe('duration utilities', () => {
  describe('secondsToHMS', () => {
    it('converts 1800 seconds to 0h 30m 0s', () => {
      const result = secondsToHMS(1800);
      expect(result).toEqual({ h: 0, m: 30, s: 0 });
    });

    it('converts 4530 seconds to 1h 15m 30s', () => {
      const result = secondsToHMS(4530);
      expect(result).toEqual({ h: 1, m: 15, s: 30 });
    });

    it('converts 0 seconds to 0h 0m 0s', () => {
      const result = secondsToHMS(0);
      expect(result).toEqual({ h: 0, m: 0, s: 0 });
    });

    it('handles null input as 0 seconds', () => {
      const result = secondsToHMS(null);
      expect(result).toEqual({ h: 0, m: 0, s: 0 });
    });
  });

  describe('hmsToSeconds', () => {
    it('converts 0h 30m 0s to 1800 seconds', () => {
      const result = hmsToSeconds(0, 30, 0);
      expect(result).toBe(1800);
    });

    it('converts 1h 15m 30s to 4530 seconds', () => {
      const result = hmsToSeconds(1, 15, 30);
      expect(result).toBe(4530);
    });

    it('handles high minutes (90 minutes) correctly', () => {
      const result = hmsToSeconds(0, 90, 0);
      expect(result).toBe(5400);
    });
  });

  describe('round-trip conversions', () => {
    it('secondsToHMS and hmsToSeconds are inverses', () => {
      const originalSeconds = 4530;
      const hms = secondsToHMS(originalSeconds);
      const convertedBack = hmsToSeconds(hms.h, hms.m, hms.s);
      expect(convertedBack).toBe(originalSeconds);
    });
  });
});
