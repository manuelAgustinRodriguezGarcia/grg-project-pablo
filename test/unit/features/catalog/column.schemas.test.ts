import { describe, expect, it } from "vitest";
import {
  createColumnSchema,
  setColumnVisibilitySchema,
  updateColumnSchema,
} from "@/features/catalog/schemas/column.schemas";
import { productPaginationQuerySchema } from "@/features/catalog/schemas/product.schemas";

describe("column.schemas", () => {
  it("valida createColumnSchema", () => {
    const parsed = createColumnSchema.safeParse({
      folderId: "clh3pb1a3000012345678902cd",
      originalName: "Código",
      displayName: "Código",
      internalKey: "codigo",
    });

    expect(parsed.success).toBe(true);
  });

  it("rechaza claves internas inválidas", () => {
    const parsed = createColumnSchema.safeParse({
      folderId: "clh3pb1a3000012345678902cd",
      originalName: "Código",
      displayName: "Código",
      internalKey: "Codigo Invalido",
    });

    expect(parsed.success).toBe(false);
  });

  it("valida updateColumnSchema con al menos un campo", () => {
    const parsed = updateColumnSchema.safeParse({
      id: "clh3pb1a3000012345678903ef",
      displayName: "Referencia",
    });

    expect(parsed.success).toBe(true);
  });

  it("valida campos de ayuda contextual", () => {
    const parsed = updateColumnSchema.safeParse({
      id: "clh3pb1a3000012345678903ef",
      helpText: "Explica la medida entre tapa.",
      helpImageAltText: "Diagrama de pieza",
    });

    expect(parsed.success).toBe(true);
  });

  it("rechaza helpText demasiado largo", () => {
    const parsed = updateColumnSchema.safeParse({
      id: "clh3pb1a3000012345678903ef",
      helpText: "a".repeat(2001),
    });

    expect(parsed.success).toBe(false);
  });

  it("valida setColumnVisibilitySchema", () => {
    const parsed = setColumnVisibilitySchema.safeParse({
      id: "clh3pb1a3000012345678903ef",
      visible: false,
    });

    expect(parsed.success).toBe(true);
  });
});

describe("product.schemas", () => {
  it("aplica defaults de paginación", () => {
    const parsed = productPaginationQuerySchema.safeParse({});

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({ page: 1, pageSize: 50 });
    }
  });

  it("rechaza pageSize fuera de rango", () => {
    const parsed = productPaginationQuerySchema.safeParse({ pageSize: 500 });

    expect(parsed.success).toBe(false);
  });
});
