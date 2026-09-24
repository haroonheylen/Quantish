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
// Unit prices can have up to 4 decimals (e.g. €1,2350 per kg).
// The regular euro format would round those to 2, which would be misleading.
const unitPriceFormat = new Intl.NumberFormat('nl-BE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function formatUnitPrice(value: string): string {
  return unitPriceFormat.format(Number(value));
}

// "wall" -> "Wall"
export function formatType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// { thickness: 0.14, height: 2.7 } -> "thickness 0,14 m, height 2,7 m"
export function formatProperties(properties: Record<string, number>): string {
  return Object.entries(properties)
    .map(([key, value]) => `${key} ${quantityFormat.format(value)} m`)
    .join(', ');
}

// Exact sum of money strings like "114.50", using whole cents.
// Integers are exact in JavaScript, so there's no floating point error:
// adding "0.10" and "0.20" gives exactly "0.30".
export function sumMoney(values: string[]): string {
  let cents = 0;
  for (const value of values) {
    const [whole = '0', fraction = ''] = value.split('.');
    cents += Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
  }
  const euros = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, '0');
  return `${euros}.${rest}`;
}