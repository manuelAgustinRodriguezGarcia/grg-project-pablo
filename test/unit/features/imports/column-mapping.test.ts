import { describe, expect, it } from "vitest";
import {
  CREATE_COLUMN_VALUE,
  buildDefaultColumnMappingRows,
  buildImportColumnMapping,
  detectColumnSemanticKind,
  resolveFolderColumnKey,
} from "@/features/imports/utils/column-mapping";

describe("column-mapping utils", () => {
  it("detects semantic kinds from header names", () => {
    expect(detectColumnSemanticKind("Código")).toBe("primaryCode");
    expect(detectColumnSemanticKind("Descripción")).toBe("description");
    expect(detectColumnSemanticKind("Código imagen")).toBe("imageCode");
  });

  it("preselects folder columns by original name", () => {
    const rows = buildDefaultColumnMappingRows(
      [
        { originalName: "Código", internalKey: "codigo", columnIndex: 0 },
        { originalName: "Marca", internalKey: "marca", columnIndex: 1 },
      ],
      [{ id: "1", originalName: "Código", internalKey: "codigo_principal" }],
    );

    expect(rows[0]?.targetValue).toBe("codigo_principal");
    expect(rows[1]?.targetValue).toBe(CREATE_COLUMN_VALUE);
  });

  it("builds import mapping and resolves folder keys", () => {
    const rows = buildDefaultColumnMappingRows(
      [{ originalName: "Peso", internalKey: "peso", columnIndex: 3 }],
      [],
    );

    const mapping = buildImportColumnMapping(rows);
    expect(mapping).toEqual([
      {
        headerInternalKey: "peso",
        folderColumnInternalKey: "peso",
      },
    ]);
    expect(resolveFolderColumnKey("peso", rows)).toBe("peso");
  });
});
