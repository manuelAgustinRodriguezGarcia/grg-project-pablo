import { describe, expect, it } from "vitest";
import {
  catalogIdSchema,
  createCatalogSchema,
  reorderCatalogsSchema,
  setCatalogVisibilitySchema,
  updateCatalogSchema,
} from "@/features/catalog/schemas/catalog.schemas";
import { CATALOG_ID } from "../../../helpers/fixtures/catalog.fixture";

describe("createCatalogSchema", () => {
  it("acepta un catálogo válido", () => {
    const result = createCatalogSchema.safeParse({
      name: "Rulemanes",
      description: "Descripción",
      status: "ACTIVE",
      order: 0,
      visibleToNormalUser: true,
    });

    expect(result.success).toBe(true);
  });

  it("rechaza nombre vacío", () => {
    const result = createCatalogSchema.safeParse({ name: "" });

    expect(result.success).toBe(false);
  });

  it("rechaza nombre demasiado largo", () => {
    const result = createCatalogSchema.safeParse({ name: "a".repeat(201) });

    expect(result.success).toBe(false);
  });

  it("rechaza orden negativo", () => {
    const result = createCatalogSchema.safeParse({
      name: "Rulemanes",
      order: -1,
    });

    expect(result.success).toBe(false);
  });
});

describe("updateCatalogSchema", () => {
  it("acepta actualización parcial", () => {
    const result = updateCatalogSchema.safeParse({
      id: CATALOG_ID,
      name: "Nuevo nombre",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza actualización sin campos", () => {
    const result = updateCatalogSchema.safeParse({ id: CATALOG_ID });

    expect(result.success).toBe(false);
  });

  it("rechaza id inválido", () => {
    const result = updateCatalogSchema.safeParse({
      id: "id-invalido",
      name: "Nombre",
    });

    expect(result.success).toBe(false);
  });
});

describe("reorderCatalogsSchema", () => {
  it("acepta una lista de reorden", () => {
    const result = reorderCatalogsSchema.safeParse({
      items: [{ id: CATALOG_ID, order: 1 }],
    });

    expect(result.success).toBe(true);
  });

  it("rechaza lista vacía", () => {
    const result = reorderCatalogsSchema.safeParse({ items: [] });

    expect(result.success).toBe(false);
  });
});

describe("catalogIdSchema", () => {
  it("acepta un cuid válido", () => {
    const result = catalogIdSchema.safeParse({ catalogId: CATALOG_ID });

    expect(result.success).toBe(true);
  });
});

describe("setCatalogVisibilitySchema", () => {
  it("acepta visibilidad booleana", () => {
    const result = setCatalogVisibilitySchema.safeParse({
      catalogId: CATALOG_ID,
      visible: false,
    });

    expect(result.success).toBe(true);
  });
});
