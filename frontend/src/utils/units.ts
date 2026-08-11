// Unit conversion helpers for the profile form. Canonical storage is always
// metric (kg/cm) — these only convert for display/input, never persisted as-is.

export function kgToLbs(kg: number): number {
  return kg * 2.2046226218;
}

export function lbsToKg(lbs: number): number {
  return lbs / 2.2046226218;
}

export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  // Rounding inches up to 12 should carry into the next foot.
  if (inches === 12) {
    return { feet: feet + 1, inches: 0 };
  }
  return { feet, inches };
}

export function ftInToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * 2.54;
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
