export function normalizeCodeForMatch(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[\s\-_./\\]+/g, "");
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
