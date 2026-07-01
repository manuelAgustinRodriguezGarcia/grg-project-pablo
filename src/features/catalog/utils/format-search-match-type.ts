import type { SearchMatchType } from "@/features/catalog/types/global-search.types";

export function formatSearchMatchType(matchType: SearchMatchType): string {
  switch (matchType) {
    case "primaryCode":
      return "Código";
    case "equivalence":
      return "Equivalencia";
    case "description":
      return "Descripción";
    case "indexedText":
      return "Texto indexado";
    case "column":
      return "Columna";
    default: {
      const exhaustive: never = matchType;
      return exhaustive;
    }
  }
}

export function truncateMatchValue(value: string, maxLength = 80): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1)}…`;
}
