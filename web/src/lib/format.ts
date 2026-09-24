import type { Unit } from '@/api/types';

// Belgian formatting: "€ 1.234,56" with a comma for decimals.
// Number() is fine here because it's display only: the value already has
// at most 2 decimals, and no arithmetic happens in the browser.
const euro = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' });

const quantityFormat = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 3 });

export function formatEuro(value: string): string {
  return euro.format(Number(value));
}

export function formatQuantity(value: string): string {
  return quantityFormat.format(Number(value));
}

// The API stores plain ASCII units. Show them as a person would write them.
const UNIT_LABELS: Record<Unit, string> = {
  m: 'm',
  m2: 'm²',
  m3: 'm³',
  kg: 'kg',
  piece: 'pc',
};

export function formatUnit(unit: Unit): string {
  return UNIT_LABELS[unit];
}