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

  it("USUARIO y VISUALIZACION excluyen entidades ocultas", () => {
    const visibleCatalog = createCatalogFixture({ visibleToNormalUser: true });
    const hiddenCatalog = createCatalogFixture({ visibleToNormalUser: false });
    const visibleFolder = createFolderFixture({ visibleToNormalUser: true, status: "ACTIVE" });
    const hiddenFolder = createFolderFixture({ visibleToNormalUser: false, status: "ACTIVE" });
    const inactiveFolder = createFolderFixture({ visibleToNormalUser: true, status: "INACTIVE" });
    const visibleColumn = createColumnFixture({ visibleToNormalUser: true });
    const hiddenColumn = createColumnFixture({ visibleToNormalUser: false });

    for (const role of ["USUARIO", "VISUALIZACION"] as const) {
      expect(
        visibilityService.filterCatalogs([visibleCatalog, hiddenCatalog], role),
      ).toEqual([visibleCatalog]);
      expect(
        visibilityService.filterFolders(
          [visibleFolder, hiddenFolder, inactiveFolder],
          role,
        ),
      ).toEqual([visibleFolder]);
      expect(
        visibilityService.filterColumns([visibleColumn, hiddenColumn], role),
      ).toEqual([visibleColumn]);
    }
  });

  it("assertCatalogVisibleForRole lanza error para roles no admin en catálogo oculto", () => {
    const hiddenCatalog = createCatalogFixture({ visibleToNormalUser: false });

    for (const role of ["USUARIO", "VISUALIZACION"] as const) {
      expect(() =>
        visibilityService.assertCatalogVisibleForRole(hiddenCatalog, role),
      ).toThrow(VisibilityError);
    }

    expect(() =>
      visibilityService.assertCatalogVisibleForRole(hiddenCatalog, "ADMIN"),
    ).not.toThrow();
  });

  it("assertFolderVisibleForRole lanza error para carpeta oculta o inactiva", () => {
    const hiddenFolder = createFolderFixture({ visibleToNormalUser: false });
    const inactiveFolder = createFolderFixture({ status: "INACTIVE" });

    for (const role of ["USUARIO", "VISUALIZACION"] as const) {
      expect(() =>
        visibilityService.assertFolderVisibleForRole(hiddenFolder, role),
      ).toThrow(VisibilityError);
      expect(() =>
        visibilityService.assertFolderVisibleForRole(inactiveFolder, role),
      ).toThrow(VisibilityError);
    }
  });

  it("stripHiddenDynamicData elimina claves ocultas para USUARIO y VISUALIZACION", () => {
    const dynamicData = {
      codigo: "ABC",
      marca: "SKF",
      nota_interna: "solo admin",
    };

    for (const role of ["USUARIO", "VISUALIZACION"] as const) {
      const result = visibilityService.stripHiddenDynamicData(
        dynamicData,
        ["codigo", "marca"],
        role,
      );

      expect(result).toEqual({ codigo: "ABC", marca: "SKF" });
    }
  });

  it("stripHiddenDynamicData conserva todo para ADMIN", () => {
    const dynamicData = { codigo: "ABC", nota_interna: "solo admin" };

    expect(
      visibilityService.stripHiddenDynamicData(dynamicData, ["codigo"], "ADMIN"),
    ).toEqual(dynamicData);
  });
});
