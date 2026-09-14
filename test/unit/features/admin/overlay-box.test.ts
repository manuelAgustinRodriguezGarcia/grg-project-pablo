import { describe, expect, it } from "vitest";
import {
  clipOverlayBoxToViewport,
  shouldUseScopedOverlayTarget,
} from "@/features/admin/utils/overlay-box";

describe("clipOverlayBoxToViewport", () => {
  it("recorta un contenedor más alto que el viewport y deja el dock afuera", () => {
    const box = clipOverlayBoxToViewport(
      { top: 115.5, left: 0, right: 527, bottom: 1668.72 },
      { top: 0, left: 0, right: 527, bottom: 828 },
    );

    expect(box).toEqual({
      top: 115.5,
      left: 0,
      width: 527,
      height: 712.5,
    });
  });

  it("no recorta cuando el target ya cabe en el viewport", () => {
    const box = clipOverlayBoxToViewport(
      { top: 116, left: 76, right: 1440, bottom: 900 },
      { top: 0, left: 0, right: 1440, bottom: 900 },
    );

    expect(box).toEqual({
      top: 116,
      left: 76,
      width: 1364,
      height: 784,
    });
  });
});

describe("shouldUseScopedOverlayTarget", () => {
  it("cubre solo el contenido interno al navegar dentro de Facturación", () => {
    expect(
      shouldUseScopedOverlayTarget(
        "/admin/facturacion/clientes",
        "/admin/facturacion",
      ),
    ).toBe(true);
    expect(
      shouldUseScopedOverlayTarget("/admin/facturacion", "/admin/facturacion"),
    ).toBe(true);
  });

  it("cubre el main completo al salir de Facturación", () => {
    expect(
      shouldUseScopedOverlayTarget("/admin", "/admin/facturacion"),
    ).toBe(false);
    expect(
      shouldUseScopedOverlayTarget("/admin/catalogos", "/admin/facturacion"),
    ).toBe(false);
    expect(shouldUseScopedOverlayTarget("/admin/catalogos", null)).toBe(false);
  });
});
