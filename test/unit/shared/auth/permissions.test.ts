import { describe, expect, it } from "vitest";
import {
  canAccessRoute,
  hasPermission,
  ROLE_PERMISSIONS,
} from "@/shared/auth/permissions";

describe("ROLE_PERMISSIONS", () => {
  it("VISITANTE solo lee catálogos y precios", () => {
    expect(ROLE_PERMISSIONS.VISITANTE).toEqual([
      "catalogs.read",
      "prices.read",
    ]);
    expect(hasPermission("VISITANTE", "invoices.read")).toBe(false);
    expect(canAccessRoute("VISITANTE", "/admin/facturacion")).toBe(false);
    expect(
      canAccessRoute("VISITANTE", "/admin/facturacion/libros-iva/resumenes"),
    ).toBe(false);
  });

  it("VENDEDOR opera facturación sin admin", () => {
    expect(hasPermission("VENDEDOR", "invoices.create")).toBe(true);
    expect(hasPermission("VENDEDOR", "clients.create")).toBe(true);
    expect(hasPermission("VENDEDOR", "clients.update")).toBe(false);
    expect(hasPermission("VENDEDOR", "settings.read")).toBe(false);
    expect(canAccessRoute("VENDEDOR", "/admin/facturacion/nueva-factura")).toBe(
      true,
    );
    expect(
      canAccessRoute("VENDEDOR", "/admin/facturacion/libros-iva/resumenes"),
    ).toBe(true);
    expect(
      canAccessRoute("VENDEDOR", "/admin/facturacion/configuracion-fiscal"),
    ).toBe(false);
  });

  it("VISITANTE_AVANZADO factura y crea clientes o movimientos sin editar ni borrar", () => {
    expect(hasPermission("VISITANTE_AVANZADO", "settings.read")).toBe(true);
    expect(hasPermission("VISITANTE_AVANZADO", "movements.read")).toBe(true);
    expect(hasPermission("VISITANTE_AVANZADO", "invoices.create")).toBe(true);
    expect(hasPermission("VISITANTE_AVANZADO", "clients.create")).toBe(true);
    expect(hasPermission("VISITANTE_AVANZADO", "movements.create")).toBe(true);
    expect(hasPermission("VISITANTE_AVANZADO", "invoices.update")).toBe(false);
    expect(hasPermission("VISITANTE_AVANZADO", "clients.update")).toBe(false);
    expect(hasPermission("VISITANTE_AVANZADO", "clients.delete")).toBe(false);
    expect(hasPermission("VISITANTE_AVANZADO", "movements.update")).toBe(false);
    expect(hasPermission("VISITANTE_AVANZADO", "categories.update")).toBe(
      false,
    );
    expect(hasPermission("VISITANTE_AVANZADO", "categories.delete")).toBe(
      false,
    );
    expect(hasPermission("VISITANTE_AVANZADO", "users.manage")).toBe(false);
    expect(canAccessRoute("VISITANTE_AVANZADO", "/admin/usuarios")).toBe(false);
    expect(canAccessRoute("VISITANTE_AVANZADO", "/admin/archivos")).toBe(true);
  });

  it("ADMINISTRADOR tiene acceso total", () => {
    expect(hasPermission("ADMINISTRADOR", "users.manage")).toBe(true);
    expect(hasPermission("ADMINISTRADOR", "catalogs.import")).toBe(true);
    expect(hasPermission("ADMINISTRADOR", "statistics.read")).toBe(true);
    expect(canAccessRoute("ADMINISTRADOR", "/admin/usuarios")).toBe(true);
  });

  it("statistics.read queda en administrador y visitante avanzado", () => {
    expect(hasPermission("VISITANTE_AVANZADO", "statistics.read")).toBe(true);
    expect(hasPermission("VENDEDOR", "statistics.read")).toBe(false);
    expect(hasPermission("VISITANTE", "statistics.read")).toBe(false);
    expect(hasPermission("VENDEDOR", "invoices.read")).toBe(true);
    expect(canAccessRoute("ADMINISTRADOR", "/admin/facturacion/estadisticas")).toBe(
      true,
    );
    expect(
      canAccessRoute("VISITANTE_AVANZADO", "/admin/facturacion/estadisticas"),
    ).toBe(true);
    expect(
      canAccessRoute(
        "VISITANTE_AVANZADO",
        "/admin/facturacion/configuracion-fiscal",
      ),
    ).toBe(true);
    expect(canAccessRoute("VENDEDOR", "/admin/facturacion/estadisticas")).toBe(
      false,
    );
    expect(canAccessRoute("VISITANTE", "/admin/facturacion/estadisticas")).toBe(
      false,
    );
    expect(canAccessRoute("VENDEDOR", "/admin/facturacion/facturas")).toBe(true);
    expect(canAccessRoute("VENDEDOR", "/admin/facturacion/libros-iva")).toBe(
      true,
    );
    expect(
      canAccessRoute("VISITANTE", "/admin/facturacion/libros-iva/resumenes"),
    ).toBe(false);
  });
});
