import { describe, expect, it } from "vitest";
import {
  buildScopedPriceItemSearchSql,
  resolvePriceListSearchSources,
} from "@/server/search/price-list-search";
import { buildSearchQueryPlan } from "@/server/search/search-query-plan";

const columns = [
  {
    internalKey: "codigo",
    displayName: "Código principal",
    originalName: "Código principal",
    isPrimaryCode: true,
    isDescription: false,
    isPrice: false,
  },
  {
    internalKey: "equivalencias",
    displayName: "Equivalencias",
    originalName: "EQUIVALENCIAS",
    isPrimaryCode: false,
    isDescription: false,
    isPrice: false,
  },
  {
    internalKey: "otros_datos",
    displayName: "Otros datos",
    originalName: "Otros datos",
    isPrimaryCode: false,
    isDescription: false,
    isPrice: false,
  },
  {
    internalKey: "precio",
    displayName: "Precio",
    originalName: "Precio",
    isPrimaryCode: false,
    isDescription: false,
    isPrice: true,
  },
  {
    internalKey: "montadora",
    displayName: "Montadora",
    originalName: "Montadora",
    isPrimaryCode: false,
    isDescription: false,
    isPrice: false,
  },
];

describe("resolvePriceListSearchSources", () => {
  it("incluye código principal, equivalencias y otros datos", () => {
    expect(resolvePriceListSearchSources(columns)).toEqual({
      includePrimaryCode: true,
      descriptionRole: null,
      amountRole: null,
      dynamicFields: [
        { key: "equivalencias", role: "equivalence" },
        { key: "otros_datos", role: "other" },
      ],
    });
  });

  it("reconoce otros datos guardados como descripción", () => {
    expect(
      resolvePriceListSearchSources([
        {
          internalKey: "otros_datos",
          displayName: "Otros\ndatos",
          originalName: "Otros datos",
          isPrimaryCode: false,
          isDescription: true,
          isPrice: false,
        },
      ]),
    ).toEqual({
      includePrimaryCode: false,
      descriptionRole: "other",
      amountRole: null,
      dynamicFields: [],
    });
  });
});

describe("buildScopedPriceItemSearchSql", () => {
  const sources = resolvePriceListSearchSources(columns);

  it("arma la búsqueda de un código compacto sin el texto normalizado pegado", () => {
    const plan = buildSearchQueryPlan("6205");
    const sql = buildScopedPriceItemSearchSql(plan!, sources);
    const values = sql.values.map((value) => String(value));

    expect(sql.strings.join(" ")).toContain('"primaryCode"');
    expect(values).toEqual(expect.arrayContaining(["equivalencias", "otros_datos", "%6205%", "6205%"]));
    expect(values).not.toContain("precio");
    expect(values).not.toContain("montadora");
    expect(values.filter((value) => value === "%6205%")).toHaveLength(1);
  });

  it("exige todas las palabras y conserva el texto normalizado", () => {
    const plan = buildSearchQueryPlan("rodamiento bolas");
    const sql = buildScopedPriceItemSearchSql(plan!, sources);
    const values = sql.values.map((value) => String(value));

    expect(plan?.includeNormalizedText).toBe(true);
    expect(values).toEqual(
      expect.arrayContaining(["%rodamiento%", "%bolas%", "%RODAMIENTO%", "%BOLAS%", "%RODAMIENTOBOLAS%"]),
    );
  });
});
