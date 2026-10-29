import Decimal from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export function d(value: Decimal.Value | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  return new Decimal(value);
}

export function toStorage(value: Decimal.Value): string {
  const fixed = d(value).toDecimalPlaces(12, Decimal.ROUND_HALF_UP).toFixed(12);
  if (!fixed.includes(".")) return fixed;
  return fixed.replace(/0+$/, "").replace(/\.$/, "");
}

export function parseDecimal(input: string): Decimal | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!trimmed) return null;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  return new Decimal(trimmed);
}

export function isBlank(value: string | null | undefined) {
  return value === null || value === undefined || value.trim() === "";
}
