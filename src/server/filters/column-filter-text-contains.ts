import { Prisma } from "@/generated/prisma/client";
import { normalizeTextContains } from "@/server/search/search-normalizer";

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

/**
 * Column-filter `contains` only: treat newlines/tabs/spaces as equivalent
 * whitespace so "TIPO INDIEL" matches Excel values like "TIPO\\nINDIEL".
 * Does not alter stored data or table display.
 */
export function buildJsonTextContainsCondition(
  columnInternalKey: string,
  value: string,
): Prisma.Sql {
  const pattern = `%${escapeIlikePattern(normalizeTextContains(value))}%`;
  return Prisma.sql`regexp_replace("dynamicData"->>${columnInternalKey}, '[[:space:]]+', ' ', 'g') ILIKE ${pattern}`;
}
