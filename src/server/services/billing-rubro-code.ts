const CODE_PREFIX_MAX_LENGTH = 5;
const CODE_PREFIX_FALLBACK = "RUB";
const CODE_NUMBER_PAD_LENGTH = 4;

export function buildBillingRubroCodePrefix(name: string): string {
  const withoutDiacritics = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const firstWord = withoutDiacritics.trim().split(/\s+/)[0] ?? "";
  const compacted = firstWord.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prefix = compacted.slice(0, CODE_PREFIX_MAX_LENGTH);

  return prefix.length >= 2 ? prefix : CODE_PREFIX_FALLBACK;
}

export function buildBillingRubroCode(name: string, codeNumber: number): string {
  const prefix = buildBillingRubroCodePrefix(name);
  const sequence = String(codeNumber).padStart(CODE_NUMBER_PAD_LENGTH, "0");
  return `${prefix}-${sequence}`;
}
