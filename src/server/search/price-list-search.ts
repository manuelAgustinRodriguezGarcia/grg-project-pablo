import { Prisma } from "@/generated/prisma/client";
import { VALID_JSON_COLUMN_KEY } from "@/server/filters/json-column-key";
import type { SearchQueryPlan } from "@/server/search/search-query-plan";
import { normalizeHeaderNameForSemantics } from "@/shared/import/header-semantics";

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

export type PriceListSearchFieldRole = "equivalence" | "other";

export type PriceListSearchSources = {
  includePrimaryCode: boolean;
  descriptionRole: PriceListSearchFieldRole | null;
  amountRole: PriceListSearchFieldRole | null;
  dynamicFields: Array<{ key: string; role: PriceListSearchFieldRole }>;
};

function emptySources(): PriceListSearchSources {
  return {
    includePrimaryCode: false,
    descriptionRole: null,
    amountRole: null,
    dynamicFields: [],
  };
}

function columnLabels(column: PriceListSearchColumn): string[] {
  return [column.displayName, column.originalName, column.internalKey.replace(/[_-]+/g, " ")]
    .map((label) => normalizeHeaderNameForSemantics(label).toLowerCase())
    .filter((label) => label.length > 0);
}

function isEquivalenceLabel(label: string): boolean {
  return label.includes("equivalen");
}

function isOtherDataLabel(label: string): boolean {
  const compact = label.replace(/[^a-z0-9]+/g, "");
  return label.includes("otros datos") || compact.includes("otrosdatos");
}

function resolveRole(column: PriceListSearchColumn): PriceListSearchFieldRole | null {
  const labels = columnLabels(column);
  if (labels.some(isEquivalenceLabel)) {
    return "equivalence";
  }
  if (labels.some(isOtherDataLabel)) {
    return "other";
  }
  return null;
}

export function resolvePriceListSearchSources(
  columns: PriceListSearchColumn[],
): PriceListSearchSources {
  const sources = emptySources();

  for (const column of columns) {
    if (column.isPrimaryCode) {
      sources.includePrimaryCode = true;
      continue;
    }

    const role = resolveRole(column);
    if (!role) {
      continue;
    }

    if (column.isDescription) {
      sources.descriptionRole = role;
      continue;
    }

    if (column.isPrice) {
      sources.amountRole = role;
      continue;
    }

    if (!VALID_JSON_COLUMN_KEY.test(column.internalKey)) {
      continue;
    }

    sources.dynamicFields.push({ key: column.internalKey, role });
  }

  return sources;
}

export function priceListSearchSourcesAreEmpty(sources: PriceListSearchSources): boolean {
  return (
    !sources.includePrimaryCode &&
    sources.descriptionRole === null &&
    sources.amountRole === null &&
    sources.dynamicFields.length === 0
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

function textExpressions(sources: PriceListSearchSources): Prisma.Sql[] {
  const expressions: Prisma.Sql[] = [];

  if (sources.includePrimaryCode) {
    expressions.push(Prisma.sql`"primaryCode"`);
  }

  if (sources.descriptionRole) {
    expressions.push(Prisma.sql`"description"`);
  }

  if (sources.amountRole) {
    expressions.push(Prisma.sql`"amount"::text`);
  }

  for (const field of sources.dynamicFields) {
    expressions.push(Prisma.sql`"dynamicData"->>${field.key}`);
  }

  return expressions;
}

function codeExpressions(sources: PriceListSearchSources): Prisma.Sql[] {
  const expressions: Prisma.Sql[] = [];

  if (sources.includePrimaryCode) {
    expressions.push(Prisma.sql`"primaryCode"`);
  }

  if (sources.descriptionRole === "equivalence") {
    expressions.push(Prisma.sql`"description"`);
  }

  if (sources.amountRole === "equivalence") {
    expressions.push(Prisma.sql`"amount"::text`);
  }

  for (const field of sources.dynamicFields) {
    if (field.role !== "equivalence") {
      continue;
    }
    expressions.push(Prisma.sql`"dynamicData"->>${field.key}`);
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

  const conditions: Prisma.Sql[] = [];
  const fields = textExpressions(sources);
  const rawText = Prisma.sql`concat_ws(' ', ${Prisma.join(fields, ", ")})`;
  const normalizedText = Prisma.sql`concat_ws(${FIELD_SEPARATOR}, ${Prisma.join(
    fields.map((field) => normalizedSql(field)),
    ", ",
  )})`;

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

  if (plan.normalizedQuery) {
    const prefix = startsWithPattern(plan.normalizedQuery);

    if (sources.includePrimaryCode) {
      conditions.push(Prisma.sql`COALESCE("normalizedCode", '') LIKE ${prefix} ESCAPE '\\'`);
    }

    for (const expression of codeExpressions(sources)) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1
        FROM regexp_split_to_table(COALESCE(${expression}, ''), '[[:space:]=|/;,]+') AS raw_token
        WHERE raw_token <> ''
          AND ${normalizedSql(Prisma.sql`raw_token`)} LIKE ${prefix} ESCAPE '\\'
      )`);
    }
  }

  if (conditions.length === 0) {
    return Prisma.sql`FALSE`;
  }

  return Prisma.sql`(${Prisma.join(conditions, " OR ")})`;
}
