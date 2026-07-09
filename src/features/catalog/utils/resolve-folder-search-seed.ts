import type { SearchResultItem } from "@/features/catalog/types/global-search.types";

/**
 * Builds the internal folder-search seed after picking a global hit.
 * Prefer codes / the query that found the hit — long column/description
 * matchValues often fail `contains` against indexedText.
 */
export function resolveFolderSearchSeed(
  item: SearchResultItem,
  fallbackQuery: string,
): string {
  const primaryCode = item.primaryCode?.trim() ?? "";
  const matchValue = item.matchValue.trim();
  const fallback = fallbackQuery.trim();

  switch (item.matchType) {
    case "primaryCode":
      return primaryCode || matchValue || fallback;
    case "equivalence":
      return matchValue || primaryCode || fallback;
    case "description":
    case "indexedText":
    case "column":
      return primaryCode || fallback || matchValue;
    default: {
      const exhaustive: never = item.matchType;
      return exhaustive;
    }
  }
}
