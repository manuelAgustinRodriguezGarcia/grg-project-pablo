/** Separadores que se ignoran al comparar códigos / términos de búsqueda. */
const SEARCH_SEPARATORS_PATTERN = /[\s\-_./\\=*.,()]+/g;

export function normalizeCodeForMatch(code: string): string {
  return code.trim().toUpperCase().replace(SEARCH_SEPARATORS_PATTERN, "");
}

export function splitSearchTokens(term: string): string[] {
  return term
    .trim()
    .split(SEARCH_SEPARATORS_PATTERN)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function buildExistingCodeIndex(
  products: Array<{ id: string; primaryCode: string | null; normalizedCode: string | null }>,
): Map<string, string> {
  const index = new Map<string, string>();

  for (const product of products) {
    const candidates = [product.primaryCode, product.normalizedCode].filter(
      (value): value is string => Boolean(value?.trim()),
    );

    for (const candidate of candidates) {
      index.set(normalizeCodeForMatch(candidate), product.id);
    }
  }

  return index;
}

export function findMatchingProductId(
  primaryCode: string | null,
  index: Map<string, string>,
): string | undefined {
  if (!primaryCode?.trim()) {
    return undefined;
  }

  return index.get(normalizeCodeForMatch(primaryCode));
}
