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
  it("busca todas las columnas de texto y deja afuera el precio", () => {
    expect(resolvePriceListSearchSources(columns)).toEqual({
      includePrimaryCode: true,
      includeDescription: false,
      dynamicKeys: ["equivalencias", "otros_datos", "montadora"],
    });
  });

  it("incluye la descripción aunque el título no diga otros datos", () => {
    expect(
      resolvePriceListSearchSources([
        {
          internalKey: "detalle",
          displayName: "Detalle",
          originalName: "DESCRIPCION",
          isPrimaryCode: false,
          isDescription: true,
          isPrice: false,
        },
      ]),
    ).toEqual({
      includePrimaryCode: false,
      includeDescription: true,
      dynamicKeys: [],
    });
  });
});

describe("buildScopedPriceItemSearchSql", () => {
  const sources = resolvePriceListSearchSources(columns);

  it("arma la búsqueda de un código compacto sin el texto normalizado pegado", () => {
    const plan = buildSearchQueryPlan("6205");
    const sql = buildScopedPriceItemSearchSql(plan!, sources);
    const text = sql.strings.join(" ");
    const values = sql.values.map((value) => String(value));

    expect(text).toContain('"primaryCode"');
    expect(text).toContain('"normalizedCode"');
    expect(text).not.toContain('"amount"');
    expect(values).toEqual(
      expect.arrayContaining(["equivalencias", "otros_datos", "montadora", "%6205%", "6205%"]),
    );
    expect(values).not.toContain("precio");
    expect(values.filter((value) => value === "%6205%")).toHaveLength(1);
  });

  it("exige todas las palabras y conserva el texto normalizado de cada columna", () => {
    const plan = buildSearchQueryPlan("rodamiento bolas");
    const sql = buildScopedPriceItemSearchSql(plan!, sources);
    const values = sql.values.map((value) => String(value));

    expect(plan?.includeNormalizedText).toBe(true);
    expect(sql.strings.join(" ")).not.toContain('"description"');
    expect(sql.strings.join(" ")).not.toContain('"amount"');
    expect(values).toEqual(
      expect.arrayContaining(["%rodamiento%", "%bolas%", "%RODAMIENTO%", "%BOLAS%", "%RODAMIENTOBOLAS%"]),
    );
    expect(values).not.toContain("precio");
  });

  it("encuentra un código con separadores usando la forma compacta", () => {
    const plan = buildSearchQueryPlan("6205-2RS");
    const sql = buildScopedPriceItemSearchSql(plan!, sources);
    const values = sql.values.map((value) => String(value));

    expect(plan?.includeNormalizedText).toBe(true);
    expect(values).toEqual(expect.arrayContaining(["%6205%", "%2RS%", "%62052RS%"]));
  });
});
