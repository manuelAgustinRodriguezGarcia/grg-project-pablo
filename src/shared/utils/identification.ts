const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

export const CUIT_LENGTH = 11;
export const DNI_MIN_LENGTH = 7;
export const DNI_MAX_LENGTH = 8;

export function normalizeIdentificationDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

export function isValidCuit(value: string): boolean {
  const digits = normalizeIdentificationDigits(value);

  if (digits.length !== CUIT_LENGTH) {
    return false;
  }

  const numbers = digits.split("").map(Number);
  const sum = CUIT_WEIGHTS.reduce(
    (accumulated, weight, index) => accumulated + weight * numbers[index],
    0,
  );

  const remainder = 11 - (sum % 11);
  const expectedVerifier = remainder === 11 ? 0 : remainder;

  if (expectedVerifier === 10) {
    return false;
  }

  return expectedVerifier === numbers[CUIT_LENGTH - 1];
}

export function formatCuit(value: string): string {
  const digits = normalizeIdentificationDigits(value);

  if (digits.length !== CUIT_LENGTH) {
    return value;
  }

  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export function isValidDni(value: string): boolean {
  const digits = normalizeIdentificationDigits(value);
  return digits.length >= DNI_MIN_LENGTH && digits.length <= DNI_MAX_LENGTH;
}

export function formatDni(value: string): string {
  const digits = normalizeIdentificationDigits(value);

  if (!isValidDni(digits)) {
    return value;
  }

  return Number(digits).toLocaleString("es-AR");
}
