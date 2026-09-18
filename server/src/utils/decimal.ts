import type { Prisma } from '@prisma/client';

/**
 * Prisma `Decimal` does not survive `JSON.stringify` in a useful way (it becomes
 * a string), so every money field is converted to a plain number at the API
 * boundary. Kept in its own module so serializers and cost maths can both use it
 * without importing each other.
 */
export type DecimalInput = Prisma.Decimal | number | string | null | undefined;

export function toNumber(value: DecimalInput): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return value.toNumber();
}

export function toNumberOrNull(value: DecimalInput): number | null {
  if (value === null || value === undefined) return null;
  return toNumber(value);
}

/** Round to 2 decimal places, killing float noise like 0.30000000000000004. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
