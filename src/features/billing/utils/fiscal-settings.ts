export const MIN_IVA_PERCENT = 0;
export const MAX_IVA_PERCENT = 100;
export const MIN_GENERIC_CLIENT_LIMIT = 1;
export const MAX_GENERIC_CLIENT_LIMIT = 999_999_999;

export function parseIvaPercentInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return roundToTwoDecimals(parsed);
}

export function formatIvaPercent(value: number): string {
  return value.toLocaleString("es-AR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isValidIvaPercent(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= MIN_IVA_PERCENT &&
    value <= MAX_IVA_PERCENT
  );
}

export function isValidGenericClientLimit(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= MIN_GENERIC_CLIENT_LIMIT &&
    value <= MAX_GENERIC_CLIENT_LIMIT
  );
}
