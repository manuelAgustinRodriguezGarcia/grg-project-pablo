import {
  normalizeCodeForMatch,
  splitSearchTokens,
} from "@/server/importers/match-detector";

/** Delimits per-field normalized values so "30.2" + "10" cannot become "30210". */
export const INDEXED_TEXT_FIELD_SEPARATOR = "\u001f";

export function normalizeSearchTerm(term: string): string {
  return normalizeCodeForMatch(term);
}

/**
 * Texto indexado sin separadores (misma regla que códigos), para matching
 * simétrico query ↔ índice (p. ej. P.FICH ≈ P FICH ≈ PFICH).
 *
 * Prefer {@link normalizeIndexedTextParts} when field values are available, so
 * adjacent columns are not concatenated into a false match.
 */
export function normalizeIndexedText(
  indexedText: string | null | undefined,
): string | null {
  if (!indexedText?.trim()) {
    return null;
  }

  const normalized = normalizeCodeForMatch(indexedText);
  return normalized.length > 0 ? normalized : null;
}

export function normalizeIndexedTextParts(parts: string[]): string | null {
  const normalized = [
    ...new Set(
      parts
        .map((part) => normalizeCodeForMatch(part))
        .filter((part) => part.length > 0),
    ),
  ];

  return normalized.length > 0
    ? normalized.join(INDEXED_TEXT_FIELD_SEPARATOR)
    : null;
}

/**
 * Colapsa espacios para búsqueda literal contains.
 * Para ignorar separadores (espacios, guiones, etc.) usar splitSearchTokens.
 */
export function normalizeTextContains(term: string): string {
  return term.trim().replace(/\s+/g, " ");
}

export { splitSearchTokens };

export function isCodeLikeQuery(term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed) {
    return false;
  }

  if (!/\s/.test(trimmed)) {
    return true;
  }

  return /[0-9\-_./\\=*.,()]/.test(trimmed);
}

/**
 * Single compact numeric token (e.g. "30210"). These must not search the
 * glued `normalizedIndexedText` blob, where adjacent short numbers like
 * "30.2" and "10" would otherwise concatenate into a false match.
 */
export function isCompactNumericQuery(term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return false;
  }

  const tokens = splitSearchTokens(trimmed);
  if (tokens.length !== 1) {
    return false;
  }

  const normalized = normalizeSearchTerm(trimmed);
  return /^\d+$/.test(normalized) && normalized.length >= 2;
}
