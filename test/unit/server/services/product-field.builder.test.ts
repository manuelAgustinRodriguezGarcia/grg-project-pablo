import { describe, expect, it } from "vitest";
import { buildProductFields } from "@/server/services/product-field.builder";
import { ProductError } from "@/server/services/product.errors";
import { createColumnFixture } from "../../../helpers/fixtures/column.fixture";

describe("buildProductFields", () => {
  const columns = [
    createColumnFixture({
      internalKey: "codigo",
      displayName: "Código",
      isPrimaryCode: true,
      isRequired: true,
    }),
    createColumnFixture({
      id: "desc-col",
      internalKey: "descripcion",
      displayName: "Descripción",
      isDescription: true,
      isSearchable: true,
    }),
    createColumnFixture({
      id: "eq-col",
      internalKey: "equivalencias",
      displayName: "Equivalencias",
      isEquivalence: true,
    }),
    createColumnFixture({
      id: "readonly-col",
      internalKey: "nota",
      displayName: "Nota",
      isReadOnly: true,
    }),
  ];

  it("mapea campos principales y genera indexedText", () => {
    const result = buildProductFields(columns, {
      values: {
        codigo: "6205",
        descripcion: "Ruleman 6205",
        equivalencias: "2902=1408",
      },
    });

    expect(result.primaryCode).toBe("6205");
    expect(result.normalizedCode).toBe("6205");
    expect(result.description).toBe("Ruleman 6205");
    expect(result.dynamicData).toEqual({ equivalencias: "2902=1408" });
    expect(result.equivalenceTokens).toHaveLength(2);
    expect(result.indexedText).toContain("6205");
    expect(result.indexedText).toContain("2902");
    expect(result.normalizedIndexedText).toContain("6205");
    expect(result.normalizedIndexedText).toContain("2902");
    expect(result.normalizedIndexedText).not.toContain("=");
  });

  it("incluye columnas no marcadas como buscables en indexedText", () => {
    const result = buildProductFields(
      [
        ...columns,
        createColumnFixture({
          id: "brand-col",
          internalKey: "marca",
          displayName: "Marca",
          isSearchable: false,
        }),
      ],
      {
        values: {
          codigo: "6205",
          descripcion: "Ruleman 6205",
          marca: "GRG",
        },
      },
    );

    expect(result.indexedText).toContain("GRG");
  });

  it("rechaza columnas de solo lectura", () => {
    expect(() =>
      buildProductFields(columns, {
        values: {
          codigo: "6205",
          nota: "interno",
        },
      }),
    ).toThrow(ProductError);
  });

  it("rechaza columnas requeridas vacías", () => {
    expect(() =>
      buildProductFields(columns, {
        values: {
          codigo: "",
          descripcion: "Sin código",
        },
      }),
    ).toThrow(ProductError);
  });
});
