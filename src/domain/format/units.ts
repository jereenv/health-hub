import type { WeightUnit } from '@/domain/workouts/types';

export const LB_TO_KG = 0.45359237;

const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg / LB_TO_KG : kg;
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value * LB_TO_KG : value;
}

/** At most one decimal, with a trailing '.0' dropped. */
function trimDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

export function formatWeightNumber(kg: number, unit: WeightUnit): string {
  return trimDecimal(kgToUnit(kg, unit));
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${formatWeightNumber(kg, unit)} ${unit}`;
}

export function formatVolume(kg: number, unit: WeightUnit): string {
  const value = kgToUnit(kg, unit);
  if (value >= 999.5) {
    const thousands = (Math.round(value / 100) / 10).toFixed(1);
    return unit === 'kg' ? `${thousands} t` : `${thousands}k lb`;
  }
  return `${Math.round(value)} ${unit}`;
}

export function formatHeight(cm: number): string {
  const totalInches = Math.round(cm / CM_PER_INCH);
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = totalInches % INCHES_PER_FOOT;
  return `${Math.round(cm)} cm · ${feet} ft ${inches} in`;
}
