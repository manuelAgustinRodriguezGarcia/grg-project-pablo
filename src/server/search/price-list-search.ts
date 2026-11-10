import { Prisma } from "@/generated/prisma/client";
import { VALID_JSON_COLUMN_KEY } from "@/server/filters/json-column-key";
import type { SearchQueryPlan } from "@/server/search/search-query-plan";

const CODE_SEPARATORS = "-_./\\=*.,()";
const FIELD_SEPARATOR = "\u001f";

export type PriceListSearchColumn = {
  internalKey: string;
  displayName: string;
  originalName: string;
  isPrimaryCode: boolean;
  isDescription: boolean;
  isPrice: boolean;
};

export type PriceListSearchSources = {
  includePrimaryCode: boolean;
  includeDescription: boolean;
  dynamicKeys: string[];
};

export function resolvePriceListSearchSources(
  columns: PriceListSearchColumn[],
): PriceListSearchSources {
  const dynamicKeys: string[] = [];
  let includePrimaryCode = false;
  let includeDescription = false;

  for (const column of columns) {
    if (column.isPrice) {
      continue;
    }

    if (column.isPrimaryCode) {
      includePrimaryCode = true;
      continue;
    }

    if (column.isDescription) {
      includeDescription = true;
      continue;
    }

    if (!VALID_JSON_COLUMN_KEY.test(column.internalKey)) {
      continue;
    }

    dynamicKeys.push(column.internalKey);
  }

  return {
    includePrimaryCode,
    includeDescription,
    dynamicKeys,
  };
}

export function priceListSearchSourcesAreEmpty(sources: PriceListSearchSources): boolean {
  return (
    !sources.includePrimaryCode &&
    !sources.includeDescription &&
    sources.dynamicKeys.length === 0
  );
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function containsPattern(value: string): string {
  return `%${escapeLike(value)}%`;
}

function startsWithPattern(value: string): string {
  return `${escapeLike(value)}%`;
}

function normalizedSql(expression: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`upper(translate(regexp_replace(COALESCE(${expression}, ''), '[[:space:]]+', '', 'g'), ${CODE_SEPARATORS}, ''))`;
}

function fieldExpressions(sources: PriceListSearchSources): Prisma.Sql[] {
  const expressions: Prisma.Sql[] = [];

  if (sources.includePrimaryCode) {
    expressions.push(Prisma.sql`"primaryCode"`);
  }

  if (sources.includeDescription) {
    expressions.push(Prisma.sql`"description"`);
  }

  for (const key of sources.dynamicKeys) {
    expressions.push(Prisma.sql`"dynamicData"->>${key}`);
  }

  return expressions;
}

function tokenAnd(expression: Prisma.Sql, patterns: string[], operator: "ILIKE" | "LIKE"): Prisma.Sql {
  return Prisma.join(
    patterns.map((pattern) =>
      operator === "ILIKE"
        ? Prisma.sql`${expression} ILIKE ${pattern} ESCAPE '\\'`
        : Prisma.sql`${expression} LIKE ${pattern} ESCAPE '\\'`,
    ),
    " AND ",
  );
}

export function buildScopedPriceItemSearchSql(
  plan: SearchQueryPlan,
  sources: PriceListSearchSources,
): Prisma.Sql {
  if (priceListSearchSourcesAreEmpty(sources)) {
    return Prisma.sql`FALSE`;
  }

  const fields = fieldExpressions(sources);
  const rawText = Prisma.sql`concat_ws(' ', ${Prisma.join(fields, ", ")})`;
  const normalizedText = Prisma.sql`concat_ws(${FIELD_SEPARATOR}, ${Prisma.join(
    fields.map((field) => normalizedSql(field)),
    ", ",
  )})`;
  const conditions: Prisma.Sql[] = [];

  if (plan.tokens.length > 0) {
    conditions.push(Prisma.sql`(${tokenAnd(rawText, plan.tokens.map(containsPattern), "ILIKE")})`);
  }

  if (plan.includeNormalizedText && plan.normalizedTokens.length > 0) {
    conditions.push(
      Prisma.sql`(${tokenAnd(normalizedText, plan.normalizedTokens.map(containsPattern), "LIKE")})`,
    );
  }

  if (plan.includeNormalizedText && plan.compactQuery) {
    conditions.push(
      Prisma.sql`${normalizedText} LIKE ${containsPattern(plan.compactQuery)} ESCAPE '\\'`,
    );
  }

  if (plan.normalizedQuery && sources.includePrimaryCode) {
    const prefix = startsWithPattern(plan.normalizedQuery);
    conditions.push(Prisma.sql`COALESCE("normalizedCode", '') LIKE ${prefix} ESCAPE '\\'`);
  }

  if (conditions.length === 0) {
    return Prisma.sql`FALSE`;
  }

  return Prisma.sql`(${Prisma.join(conditions, " OR ")})`;
}
