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

type ContentMatchRow = {
  dynamicData: Record<string, unknown>;
  description?: string | null;
};

type ContentMatchOptions = {
  /** Only fingerprint these folder column keys (ignores newly added Excel columns). */
  allowedKeys?: readonly string[];
};

function asDynamicDataRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

/**
 * Stable fingerprint of a product/Excel row for combine matching when primary
 * codes are generated (or otherwise unreliable).
 */
export function buildRowContentFingerprint(
  row: ContentMatchRow,
  options: ContentMatchOptions = {},
): string {
  const parts: string[] = [];
  const description = row.description?.trim();

  if (description) {
    parts.push(`__description__:${normalizeCodeForMatch(description)}`);
  }

  const keys = (
    options.allowedKeys ? [...options.allowedKeys] : Object.keys(row.dynamicData)
  ).sort((left, right) => left.localeCompare(right));

  for (const key of keys) {
    const raw = row.dynamicData[key];
    if (raw == null) {
      continue;
    }

    const text = String(raw).trim();
    if (!text) {
      continue;
    }

    parts.push(`${key}:${normalizeCodeForMatch(text)}`);
  }

  return parts.join("\u001f");
}

export function buildExistingContentIndex(
  products: Array<{
    id: string;
    dynamicData: unknown;
    description?: string | null;
  }>,
  options: ContentMatchOptions = {},
): Map<string, string> {
  const index = new Map<string, string>();

  for (const product of products) {
    const fingerprint = buildRowContentFingerprint(
      {
        dynamicData: asDynamicDataRecord(product.dynamicData),
        description: product.description,
      },
      options,
    );

    if (fingerprint && !index.has(fingerprint)) {
      index.set(fingerprint, product.id);
    }
  }

  return index;
}

export function findMatchingProductIdByContent(
  row: ContentMatchRow,
  index: Map<string, string>,
  options: ContentMatchOptions = {},
): string | undefined {
  const fingerprint = buildRowContentFingerprint(row, options);
  if (!fingerprint) {
    return undefined;
  }

  return index.get(fingerprint);
}

/**
 * Resolve an existing product match for import combine:
 * - Prefer primary-code match when codes are stable (not generated).
 * - Fall back to content fingerprint (required when codes are generated).
 */
export function resolveImportProductMatchId(
  row: {
    primaryCode: string | null;
    dynamicData: Record<string, unknown>;
    description?: string | null;
  },
  indexes: {
    codeIndex: Map<string, string>;
    contentIndex: Map<string, string>;
  },
  options: ContentMatchOptions & { preferContentMatch?: boolean } = {},
): string | undefined {
  if (!options.preferContentMatch) {
    const byCode = findMatchingProductId(row.primaryCode, indexes.codeIndex);
    if (byCode) {
      return byCode;
    }
  }

  return findMatchingProductIdByContent(row, indexes.contentIndex, options);
}
