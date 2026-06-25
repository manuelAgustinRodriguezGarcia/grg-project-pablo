import { describe, expect, it } from "vitest";
import { getProductTableColumns } from "@/features/catalog/utils/product-table-columns";

describe("getProductTableColumns", () => {
  it("oculta la columna de códigos generados en importación", () => {
    const columns = getProductTableColumns([
      { internalKey: "detalle", displayName: "DETALLE" },
      { internalKey: "codigo_generado", displayName: "Código" },
      { internalKey: "numero", displayName: "NÚMERO DE ORDEN" },
    ]);

    expect(columns).toHaveLength(2);
    expect(columns.map((column) => column.internalKey)).toEqual([
      "detalle",
      "numero",
    ]);
  });

  it("mantiene la columna código principal real del Excel", () => {
    const columns = getProductTableColumns([
      { internalKey: "numero_de_orden", displayName: "NÚMERO DE ORDEN" },
    ]);

    expect(columns).toHaveLength(1);
    expect(columns[0]?.displayName).toBe("NÚMERO DE ORDEN");
  });
});
