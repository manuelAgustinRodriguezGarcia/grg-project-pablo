const CODE_PREFIX_MAX_LENGTH = 8;
const CODE_PREFIX_FALLBACK = "CLI";
const CODE_NUMBER_PAD_LENGTH = 5;
const CODE_PREFIX_MIN_LENGTH = 2;

const LEGAL_SUFFIXES = new Set([
  "SA",
  "SH",
  "SRL",
  "SL",
  "SAS",
  "SSA",
  "SC",
  "SCA",
  "SAIC",
]);

const STOPWORDS = new Set([
  "A",
  "AL",
  "CON",
  "DE",
  "DEL",
  "E",
  "EL",
  "EN",
  "LA",
  "LAS",
  "LO",
  "LOS",
  "PARA",
  "POR",
  "SAN",
  "SU",
  "SUS",
  "UN",
  "UNA",
  "Y",
]);

function compactToken(token: string): string {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function tokenContribution(
  compacted: string,
  isFirstContribution: boolean,
): { letters: string; stopAfter: boolean } {
  if (STOPWORDS.has(compacted)) {
    return { letters: compacted.slice(0, 1), stopAfter: false };
  }

  if (compacted.length === 2) {
    return { letters: compacted, stopAfter: false };
  }

  if (isFirstContribution && compacted.length === 3) {
    return { letters: compacted, stopAfter: true };
  }

  return { letters: compacted.slice(0, 1), stopAfter: false };
}

export function buildBillingClientCodePrefix(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  let prefix = "";
  let firstCompactedWord = "";
  let isFirstContribution = true;

  for (const token of tokens) {
    if (token.includes(".")) {
      continue;
    }

    const compacted = compactToken(token);
    if (!compacted || LEGAL_SUFFIXES.has(compacted)) {
      continue;
    }

    if (!firstCompactedWord) {
      firstCompactedWord = compacted;
    }

    const contribution = tokenContribution(compacted, isFirstContribution);
    prefix += contribution.letters;

    if (contribution.stopAfter) {
      break;
    }

    isFirstContribution = false;
    if (prefix.length >= CODE_PREFIX_MAX_LENGTH) {
      break;
    }
  }

  if (prefix.length >= CODE_PREFIX_MIN_LENGTH) {
    return prefix.slice(0, CODE_PREFIX_MAX_LENGTH);
  }

  if (firstCompactedWord.length >= CODE_PREFIX_MIN_LENGTH) {
    return firstCompactedWord.slice(0, 5);
  }

  return CODE_PREFIX_FALLBACK;
}

export function buildBillingClientCode(name: string, codeNumber: number): string {
  const prefix = buildBillingClientCodePrefix(name);
  const sequence = String(codeNumber).padStart(CODE_NUMBER_PAD_LENGTH, "0");
  return `${prefix}-${sequence}`;
}

export function normalizeBillingClientCode(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase().replace(/\s+/g, "");
  const match = /^([A-Z0-9]{2,10})-(\d{1,8})$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const prefix = match[1];
  const sequence = match[2].padStart(CODE_NUMBER_PAD_LENGTH, "0");
  return `${prefix}-${sequence}`;
}
