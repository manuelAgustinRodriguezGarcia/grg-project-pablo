import { describe, expect, it } from "vitest";
import {
  catalogIdParamSchema,
  createFolderFromSheetSchema,
  createFolderSchema,
  folderColumnKeysConfigSchema,
  folderIdSchema,
  reorderFoldersSchema,
  setFolderFilterConfigSchema,
  setFolderSearchConfigSchema,
  setFolderVisibilitySchema,
  updateFolderSchema,
} from "@/features/catalog/schemas/folder.schemas";
import { CATALOG_ID } from "../../../helpers/fixtures/catalog.fixture";
import { FOLDER_ID } from "../../../helpers/fixtures/folder.fixture";

describe("createFolderSchema", () => {
  it("acepta una carpeta válida", () => {
    const result = createFolderSchema.safeParse({
      catalogId: CATALOG_ID,
      name: "Rodamientos",
      description: "Descripción",
      status: "ACTIVE",
      order: 0,
      visibleToNormalUser: true,
    });

    expect(result.success).toBe(true);
  });

  it("rechaza nombre vacío", () => {
    const result = createFolderSchema.safeParse({
      catalogId: CATALOG_ID,
      name: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("createFolderFromSheetSchema", () => {
  it("acepta nombre de hoja válido", () => {
    const result = createFolderFromSheetSchema.safeParse({
      catalogId: CATALOG_ID,
      sheetName: "Hoja 1",
    });

    expect(result.success).toBe(true);
  });
});

describe("updateFolderSchema", () => {
  it("acepta actualización parcial", () => {
    const result = updateFolderSchema.safeParse({
      id: FOLDER_ID,
      name: "Nuevo nombre",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza actualización sin campos", () => {
    const result = updateFolderSchema.safeParse({ id: FOLDER_ID });

    expect(result.success).toBe(false);
  });
});

describe("reorderFoldersSchema", () => {
  it("rechaza listas vacías", () => {
    const result = reorderFoldersSchema.safeParse({
      catalogId: CATALOG_ID,
      items: [],
    });

    expect(result.success).toBe(false);
  });
});

describe("setFolderVisibilitySchema", () => {
  it("acepta visibilidad válida", () => {
    const result = setFolderVisibilitySchema.safeParse({
      folderId: FOLDER_ID,
      visible: false,
    });

    expect(result.success).toBe(true);
  });
});

describe("folderColumnKeysConfigSchema", () => {
  it("acepta claves únicas", () => {
    const result = folderColumnKeysConfigSchema.safeParse({
      columnInternalKeys: ["codigo", "descripcion"],
    });

    expect(result.success).toBe(true);
  });

  it("rechaza claves duplicadas", () => {
    const result = folderColumnKeysConfigSchema.safeParse({
      columnInternalKeys: ["codigo", "codigo"],
    });

    expect(result.success).toBe(false);
  });
});

describe("setFolderSearchConfigSchema", () => {
  it("acepta config nula", () => {
    const result = setFolderSearchConfigSchema.safeParse({
      folderId: FOLDER_ID,
      config: null,
    });

    expect(result.success).toBe(true);
  });
});

describe("setFolderFilterConfigSchema", () => {
  it("acepta config válida", () => {
    const result = setFolderFilterConfigSchema.safeParse({
      folderId: FOLDER_ID,
      config: { columnInternalKeys: ["marca"] },
    });

    expect(result.success).toBe(true);
  });
});

describe("catalogIdParamSchema", () => {
  it("acepta catalogId válido", () => {
    const result = catalogIdParamSchema.safeParse({ catalogId: CATALOG_ID });

    expect(result.success).toBe(true);
  });
});

describe("folderIdSchema", () => {
  it("acepta folderId válido", () => {
    const result = folderIdSchema.safeParse({ folderId: FOLDER_ID });

    expect(result.success).toBe(true);
  });
});
