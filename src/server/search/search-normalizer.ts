import { normalizeCodeForMatch } from "@/server/importers/match-detector";

export function normalizeSearchTerm(term: string): string {
  return normalizeCodeForMatch(term);
}

export function normalizeTextContains(term: string): string {
  return term.trim().replace(/\s+/g, " ");
}

export function isCodeLikeQuery(term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed) {
    return false;
  }

  if (!/\s/.test(trimmed)) {
    return true;
  }

  return /[0-9\-_./\\=]/.test(trimmed);
}
