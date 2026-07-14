import {
  normalizeCodeForMatch,
  splitSearchTokens,
} from "@/server/importers/match-detector";

export function normalizeSearchTerm(term: string): string {
  return normalizeCodeForMatch(term);
}

/**
 * Texto indexado sin separadores (misma regla que códigos), para matching
 * simétrico query ↔ índice (p. ej. P.FICH ≈ P FICH ≈ PFICH).
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
