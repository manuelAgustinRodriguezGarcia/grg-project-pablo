import { describe, expect, it } from "vitest";
import { createCatalogFixture } from "../../../helpers/fixtures/catalog.fixture";
import { createFolderFixture } from "../../../helpers/fixtures/folder.fixture";
import { createColumnFixture } from "../../../helpers/fixtures/column.fixture";
import { visibilityService } from "@/server/services/visibility.service";
import { VisibilityError } from "@/server/services/visibility.errors";

describe("VisibilityService", () => {
  it("ADMIN no filtra catálogos, carpetas ni columnas", () => {
    const hiddenCatalog = createCatalogFixture({ visibleToNormalUser: false });
    const hiddenFolder = createFolderFixture({ visibleToNormalUser: false });
    const hiddenColumn = createColumnFixture({ visibleToNormalUser: false });

    expect(visibilityService.filterCatalogs([hiddenCatalog], "ADMIN")).toHaveLength(1);
    expect(visibilityService.filterFolders([hiddenFolder], "ADMIN")).toHaveLength(1);
    expect(visibilityService.filterColumns([hiddenColumn], "ADMIN")).toHaveLength(1);
  });

  it("CONSULTA excluye entidades ocultas", () => {
    const visibleCatalog = createCatalogFixture({ visibleToNormalUser: true });
    const hiddenCatalog = createCatalogFixture({ visibleToNormalUser: false });
    const visibleFolder = createFolderFixture({ visibleToNormalUser: true, status: "ACTIVE" });
    const hiddenFolder = createFolderFixture({ visibleToNormalUser: false, status: "ACTIVE" });
    const inactiveFolder = createFolderFixture({ visibleToNormalUser: true, status: "INACTIVE" });
    const visibleColumn = createColumnFixture({ visibleToNormalUser: true });
    const hiddenColumn = createColumnFixture({ visibleToNormalUser: false });

    expect(
      visibilityService.filterCatalogs([visibleCatalog, hiddenCatalog], "CONSULTA"),
    ).toEqual([visibleCatalog]);
    expect(
      visibilityService.filterFolders(
        [visibleFolder, hiddenFolder, inactiveFolder],
        "CONSULTA",
      ),
    ).toEqual([visibleFolder]);
    expect(
      visibilityService.filterColumns([visibleColumn, hiddenColumn], "CONSULTA"),
    ).toEqual([visibleColumn]);
  });

  it("assertCatalogVisibleForRole lanza error para CONSULTA en catálogo oculto", () => {
    const hiddenCatalog = createCatalogFixture({ visibleToNormalUser: false });

    expect(() =>
      visibilityService.assertCatalogVisibleForRole(hiddenCatalog, "CONSULTA"),
    ).toThrow(VisibilityError);

    expect(() =>
      visibilityService.assertCatalogVisibleForRole(hiddenCatalog, "ADMIN"),
    ).not.toThrow();
  });

  it("assertFolderVisibleForRole lanza error para carpeta oculta o inactiva", () => {
    const hiddenFolder = createFolderFixture({ visibleToNormalUser: false });
    const inactiveFolder = createFolderFixture({ status: "INACTIVE" });

    expect(() =>
      visibilityService.assertFolderVisibleForRole(hiddenFolder, "CONSULTA"),
    ).toThrow(VisibilityError);
    expect(() =>
      visibilityService.assertFolderVisibleForRole(inactiveFolder, "CONSULTA"),
    ).toThrow(VisibilityError);
  });

  it("stripHiddenDynamicData elimina claves ocultas para CONSULTA", () => {
    const dynamicData = {
      codigo: "ABC",
      marca: "SKF",
      nota_interna: "solo admin",
    };

    const result = visibilityService.stripHiddenDynamicData(
      dynamicData,
      ["codigo", "marca"],
      "CONSULTA",
    );

    expect(result).toEqual({ codigo: "ABC", marca: "SKF" });
  });

  it("stripHiddenDynamicData conserva todo para ADMIN", () => {
    const dynamicData = { codigo: "ABC", nota_interna: "solo admin" };

    expect(
      visibilityService.stripHiddenDynamicData(dynamicData, ["codigo"], "ADMIN"),
    ).toEqual(dynamicData);
  });
});
