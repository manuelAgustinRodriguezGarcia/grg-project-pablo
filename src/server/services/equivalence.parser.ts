import { normalizeCodeForMatch } from "@/server/importers/match-detector";

export type ParsedEquivalenceToken = {
  originalCode: string;
  normalizedCode: string;
};

const SEPARATOR_PATTERN = /[\n\r=|/;,]+/g;

function stripParentheses(text: string): string {
  return text.replace(/[()]/g, " ").trim();
}

function splitRawTokens(text: string): string[] {
  const normalized = stripParentheses(text.trim());
  if (!normalized) {
    return [];
  }

  const parts = normalized
    .split(SEPARATOR_PATTERN)
    .flatMap((part) => part.split(/\s+/))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return parts;
}

export function parseEquivalenceText(text: string): ParsedEquivalenceToken[] {
  const seen = new Set<string>();
  const tokens: ParsedEquivalenceToken[] = [];

  for (const raw of splitRawTokens(text)) {
    const normalizedCode = normalizeCodeForMatch(raw);
    if (!normalizedCode || seen.has(normalizedCode)) {
      continue;
    }

    seen.add(normalizedCode);
    tokens.push({
      originalCode: raw,
      normalizedCode,
    });
  }

  return tokens;
}

export function collectEquivalenceTokensFromColumns(
  columns: Array<{ internalKey: string; isEquivalence: boolean }>,
  dynamicData: Record<string, unknown>,
): ParsedEquivalenceToken[] {
  const seen = new Set<string>();
  const tokens: ParsedEquivalenceToken[] = [];

  for (const column of columns) {
    if (!column.isEquivalence) {
      continue;
    }

    const value = dynamicData[column.internalKey];
    if (value === null || value === undefined) {
      continue;
    }

    const text = String(value).trim();
    if (!text) {
      continue;
    }

    for (const token of parseEquivalenceText(text)) {
      if (seen.has(token.normalizedCode)) {
        continue;
      }

      seen.add(token.normalizedCode);
      tokens.push(token);
    }
  }

  return tokens;
}
