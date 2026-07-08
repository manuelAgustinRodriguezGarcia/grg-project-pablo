import { describe, expect, it } from "vitest";
import {
  folderHasLinkedImages,
  getAdminFilterableColumnKeys,
  getProductTableColumns,
} from "@/features/catalog/utils/product-table-columns";

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

describe("getAdminFilterableColumnKeys", () => {
  it("excluye columnas de código imagen por flag o por nombre", () => {
    const keys = getAdminFilterableColumnKeys([
      {
        internalKey: "detalle",
        isImageCode: false,
        originalName: "DETALLE",
        displayName: "DETALLE",
      },
      {
        internalKey: "cod_img",
        isImageCode: false,
        originalName: "COD. IMG.",
        displayName: "COD. IMG.",
      },
      {
        internalKey: "codigo_imagen",
        isImageCode: true,
        originalName: "CODIGO IMAGEN",
        displayName: "CODIGO IMAGEN",
      },
    ]);

    expect(keys).toEqual(["detalle"]);
  });
});

describe("folderHasLinkedImages", () => {
  it("devuelve true cuando la carpeta tiene columna de código imagen", () => {
    expect(
      folderHasLinkedImages([
        {
          isImageCode: false,
          originalName: "DETALLE",
          displayName: "DETALLE",
        },
        {
          isImageCode: true,
          originalName: "CODIGO IMAGEN",
          displayName: "CODIGO IMAGEN",
        },
      ]),
    ).toBe(true);
  });

  it("devuelve false cuando no hay columna de código imagen", () => {
    expect(
      folderHasLinkedImages([
        {
          isImageCode: false,
          originalName: "DETALLE",
          displayName: "DETALLE",
        },
      ]),
    ).toBe(false);
  });
});
