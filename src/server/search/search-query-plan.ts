import {
  isCompactNumericQuery,
  normalizeSearchTerm,
  normalizeTextContains,
  splitSearchTokens,
} from "@/server/search/search-normalizer";

export const MIN_GLOBAL_QUERY_CHARS = 2;

export type SearchQueryPlan = {
  normalizedQuery: string;
  textTerm: string;
  tokens: string[];
  normalizedTokens: string[];
  compactQuery: string;
  includeNormalizedText: boolean;
};

export function buildSearchQueryPlan(query: string): SearchQueryPlan | null {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedQuery = normalizeSearchTerm(trimmed);
  const textTerm = normalizeTextContains(trimmed);
  if (!normalizedQuery && !textTerm) {
    return null;
  }

  const tokens = textTerm ? splitSearchTokens(textTerm) : [];
  const normalizedTokens = tokens
    .map((token) => normalizeSearchTerm(token))
    .filter((token) => token.length > 0);
  const includeNormalizedText = Boolean(textTerm) && !isCompactNumericQuery(textTerm);

  return {
    normalizedQuery,
    textTerm,
    tokens,
    normalizedTokens,
    compactQuery: includeNormalizedText ? normalizeSearchTerm(textTerm) : "",
    includeNormalizedText,
  };
}
