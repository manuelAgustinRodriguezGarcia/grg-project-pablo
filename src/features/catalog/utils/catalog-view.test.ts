import { describe, expect, it } from "vitest";
import {
  resolveActiveFolderId,
  resolveCatalogView,
  scrollOptionIntoMenu,
} from "./catalog-view";

describe("resolveCatalogView", () => {
  it("muestra el picker de catálogos cuando no hay catálogo activo", () => {
    expect(
      resolveCatalogView({
        activeCatalogId: "",
        activeFolderId: "",
        preferProductsShell: true,
      }),
    ).toBe("catalog-picker");
  });

  it("mantiene la shell de productos al cambiar de catálogo sin carpeta", () => {
    expect(
      resolveCatalogView({
        activeCatalogId: "catalog-2",
        activeFolderId: "",
        preferProductsShell: true,
      }),
    ).toBe("products");
  });

  it("muestra carpetas cuando aún no se eligió carpeta desde el picker", () => {
    expect(
      resolveCatalogView({
        activeCatalogId: "catalog-1",
        activeFolderId: "",
        preferProductsShell: false,
      }),
    ).toBe("folder-picker");
  });

  it("muestra productos con catálogo y carpeta", () => {
    expect(
      resolveCatalogView({
        activeCatalogId: "catalog-1",
        activeFolderId: "folder-1",
        preferProductsShell: false,
      }),
    ).toBe("products");
  });
});

describe("resolveActiveFolderId", () => {
  it("conserva la carpeta seleccionada mientras carga la navegación", () => {
    expect(
      resolveActiveFolderId({
        activeCatalogId: "catalog-2",
        selectedFolderId: "folder-target",
        isNavigationReady: false,
        folderIds: ["folder-old"],
      }),
    ).toBe("folder-target");
  });

  it("limpia la carpeta si no existe en el catálogo ya cargado", () => {
    expect(
      resolveActiveFolderId({
        activeCatalogId: "catalog-2",
        selectedFolderId: "folder-missing",
        isNavigationReady: true,
        folderIds: ["folder-a", "folder-b"],
      }),
    ).toBe("");
  });

  it("confirma la carpeta cuando ya está en la navegación", () => {
    expect(
      resolveActiveFolderId({
        activeCatalogId: "catalog-2",
        selectedFolderId: "folder-b",
        isNavigationReady: true,
        folderIds: ["folder-a", "folder-b"],
      }),
    ).toBe("folder-b");
  });
});

describe("scrollOptionIntoMenu", () => {
  it("hace scroll hacia abajo cuando la opción queda debajo del menú", () => {
    const menu = {
      getBoundingClientRect: () => ({ top: 0, bottom: 100 }),
      scrollTop: 0,
    } as HTMLElement;
    const row = {
      getBoundingClientRect: () => ({ top: 90, bottom: 130 }),
    } as HTMLElement;

    scrollOptionIntoMenu(row, menu);

    expect(menu.scrollTop).toBe(30);
  });

  it("hace scroll hacia arriba cuando la opción queda arriba del menú", () => {
    const menu = {
      getBoundingClientRect: () => ({ top: 50, bottom: 150 }),
      scrollTop: 40,
    } as HTMLElement;
    const row = {
      getBoundingClientRect: () => ({ top: 20, bottom: 40 }),
    } as HTMLElement;

    scrollOptionIntoMenu(row, menu);

    expect(menu.scrollTop).toBe(10);
  });
});
