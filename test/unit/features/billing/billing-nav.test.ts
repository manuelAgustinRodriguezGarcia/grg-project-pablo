import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BILLING_CLIENTS_PATH,
  BILLING_CONFIGURATION_PATH,
  BILLING_DEBTORS_PATH,
  BILLING_HUB_PATH,
  BILLING_INVOICES_PATH,
  BILLING_SECTIONS,
  BILLING_LIBRO_IVA_RESUMENES_PATH,
  BILLING_LIBROS_IVA_PATH,
  BILLING_MOVIMIENTOS_PATH,
  BILLING_NAV_TABS,
  BILLING_NEW_INVOICE_PATH,
  BILLING_STATISTICS_PATH,
  billingTabCurrentMenuItem,
  billingTabMatchesPath,
  filterBillingNavTabsForRole,
} from "@/features/billing/data/billingNav";
import { FileText } from "@/shared/icons";

function tabByHref(href: string) {
  const tab = BILLING_NAV_TABS.find((item) => item.href === href);
  if (!tab) {
    throw new Error(`Missing billing nav tab ${href}`);
  }
  return tab;
}

describe("billing nav tabs", () => {
  const clientsTab = tabByHref(BILLING_CLIENTS_PATH);
  const resumenTab = tabByHref(BILLING_HUB_PATH);

  it("keeps deudores under the Clientes hover menu", () => {
    expect(clientsTab.menuItems?.map((item) => item.label)).toEqual([
      "Lista de clientes",
      "Clientes con deuda",
    ]);
    expect(clientsTab.menuItems?.map((item) => item.href)).toEqual([
      BILLING_CLIENTS_PATH,
      BILLING_DEBTORS_PATH,
    ]);
    expect(clientsTab.menuItems?.map((item) => item.iconTone)).toEqual([
      "blue",
      "red",
    ]);
    expect(clientsTab.menuItems?.[1]?.icon).toBe(FileText);
    expect(clientsTab.permission).toBe("clients.read");
    expect(clientsTab.menuItems?.map((item) => item.permission)).toEqual([
      "clients.read",
      "debts.read",
    ]);
  });

  it("requires permission on every nav tab", () => {
    for (const tab of BILLING_NAV_TABS) {
      expect(tab.permission).toEqual(expect.any(String));
      for (const item of tab.menuItems ?? []) {
        expect(item.permission).toEqual(expect.any(String));
      }
    }
  });

  it("marks Clientes active on both client and debtor lists", () => {
    expect(billingTabMatchesPath(BILLING_CLIENTS_PATH, clientsTab)).toBe(true);
    expect(billingTabMatchesPath(BILLING_DEBTORS_PATH, clientsTab)).toBe(true);
    expect(billingTabMatchesPath(BILLING_HUB_PATH, clientsTab)).toBe(false);
  });

  it("does not treat nested billing routes as Resumen", () => {
    expect(billingTabMatchesPath(BILLING_CLIENTS_PATH, resumenTab)).toBe(false);
    expect(billingTabMatchesPath(BILLING_DEBTORS_PATH, resumenTab)).toBe(false);
  });

  it("resolves the current submenu item from the path", () => {
    expect(
      billingTabCurrentMenuItem(BILLING_CLIENTS_PATH, clientsTab)?.label,
    ).toBe("Lista de clientes");
    expect(
      billingTabCurrentMenuItem(BILLING_DEBTORS_PATH, clientsTab)?.label,
    ).toBe("Clientes con deuda");
  });

  it("drops the Clientes hover menu when the role only has one option", () => {
    const sellerTabs = filterBillingNavTabsForRole("VENDEDOR");
    const sellerClientsTab = sellerTabs.find(
      (tab) => tab.href === BILLING_CLIENTS_PATH,
    );

    expect(sellerClientsTab?.menuItems).toBeUndefined();
    expect(
      filterBillingNavTabsForRole("ADMINISTRADOR").find(
        (tab) => tab.href === BILLING_CLIENTS_PATH,
      )?.menuItems,
    ).toHaveLength(2);
  });

  it("ordena las siete pestañas y deja configuración fuera del menú", () => {
    expect(BILLING_NAV_TABS.map((tab) => tab.label)).toEqual([
      "Resumen",
      "Clientes",
      "Rubros",
      "Facturas",
      "Movimientos",
      "Estadísticas",
      "Libros de IVA",
    ]);
    expect(BILLING_NAV_TABS.map((tab) => tab.href)).toEqual([
      BILLING_HUB_PATH,
      BILLING_CLIENTS_PATH,
      `${BILLING_HUB_PATH}/rubros`,
      BILLING_INVOICES_PATH,
      BILLING_MOVIMIENTOS_PATH,
      BILLING_STATISTICS_PATH,
      BILLING_LIBROS_IVA_PATH,
    ]);
    expect(BILLING_NAV_TABS.map((tab) => tab.permission)).toEqual([
      "billing.hub.read",
      "clients.read",
      "categories.read",
      "invoices.read",
      "movements.read",
      "statistics.read",
      "invoices.read",
    ]);
    expect(BILLING_NAV_TABS.some((tab) => tab.label === "Configuración")).toBe(
      false,
    );
    expect(
      BILLING_NAV_TABS.some((tab) => tab.href === BILLING_NEW_INVOICE_PATH),
    ).toBe(false);
    expect(
      BILLING_SECTIONS.find((section) => section.href === BILLING_CONFIGURATION_PATH),
    ).toMatchObject({
      href: BILLING_CONFIGURATION_PATH,
      label: "Configuración",
      permission: "settings.read",
    });
  });

  it("filtra estadísticas y libros según el rol", () => {
    expect(labelsFor("ADMINISTRADOR")).toEqual([
      "Resumen",
      "Clientes",
      "Rubros",
      "Facturas",
      "Movimientos",
    ]);
    expect(labelsFor("ADMINISTRADOR", "agencygrg@gmail.com")).toEqual([
      "Resumen",
      "Clientes",
      "Rubros",
      "Facturas",
      "Movimientos",
      "Estadísticas",
      "Libros de IVA",
    ]);
    expect(labelsFor("VISITANTE_AVANZADO", "visitagrg@gmail.com")).toEqual(
      labelsFor("ADMINISTRADOR", "agencygrg@gmail.com"),
    );
    expect(labelsFor("VISITANTE_AVANZADO", "otro@rothamel.com")).toEqual(
      labelsFor("ADMINISTRADOR"),
    );
    expect(labelsFor("VENDEDOR", "agencygrg@gmail.com")).toEqual([
      "Clientes",
      "Facturas",
      "Libros de IVA",
    ]);
    expect(labelsFor("VISITANTE", "visitagrg@gmail.com")).toEqual([]);
    expect(
      filterBillingNavTabsForRole("VENDEDOR").some(
        (tab) => tab.permission === "statistics.read",
      ),
    ).toBe(false);
    expect(
      filterBillingNavTabsForRole("VENDEDOR").find(
        (tab) => tab.href === BILLING_LIBROS_IVA_PATH,
      )?.menuItems,
    ).toBeUndefined();
  });

  it("abre Libros de IVA directo en el listado, sin submenú", () => {
    const libros = tabByHref(BILLING_LIBROS_IVA_PATH);
    expect(libros.menuItems).toBeUndefined();
    expect(libros.href).toBe(BILLING_LIBROS_IVA_PATH);
    expect(billingTabMatchesPath(BILLING_LIBROS_IVA_PATH, libros)).toBe(true);
    expect(
      billingTabMatchesPath(BILLING_LIBRO_IVA_RESUMENES_PATH, libros),
    ).toBe(true);
    expect(billingTabCurrentMenuItem(BILLING_LIBROS_IVA_PATH, libros)).toBeUndefined();
    expect(billingTabMatchesPath(BILLING_STATISTICS_PATH, libros)).toBe(false);
  });

  it("conserva el generador de Libro IVA dentro de Facturas", () => {
    const source = readFileSync(
      "src/features/billing/components/invoices/ComprobantesManager.tsx",
      "utf8",
    );
    expect(source).toContain("LibroIvaDialog");
    expect(source).toContain("setIsLibroIvaOpen(true)");

    const home = readFileSync(
      "src/app/admin/facturacion/(secciones)/libros-iva/page.tsx",
      "utf8",
    );
    expect(home).toContain('requireBillingSectionPreviewOrRedirect("invoices.read"');
    expect(home).toContain("LibroIvaResumenesManager");

    const summaries = readFileSync(
      "src/app/admin/facturacion/(secciones)/libros-iva/resumenes/page.tsx",
      "utf8",
    );
    expect(summaries).toContain("redirect(BILLING_LIBROS_IVA_PATH)");
  });

  it("mantiene el menú usable en móvil sin desborde horizontal", () => {
    const nav = readFileSync(
      "src/features/billing/styles/BillingPillNav.module.scss",
      "utf8",
    );
    const libros = readFileSync(
      "src/features/billing/styles/LibroIvaResumenes.module.scss",
      "utf8",
    );
    const modal = readFileSync(
      "src/features/billing/styles/StatisticsChoiceModal.module.scss",
      "utf8",
    );

    expect(nav).toContain("@media (max-width: 1023px)");
    expect(nav).toContain("display: none");
    expect(nav).toContain("text-overflow: ellipsis");
    expect(nav).toContain("min-width: 0");
    expect(nav).toContain(".settingsButton");
    expect(libros).toContain("@media (max-width: 720px)");
    expect(libros).toContain("grid-template-columns: 1fr");
    expect(modal).toContain("@media (max-width: 560px)");
    expect(modal).toContain("overflow-wrap: anywhere");
    expect(modal).toContain("prefers-reduced-motion");
  });
});

function labelsFor(
  role: "ADMINISTRADOR" | "VISITANTE_AVANZADO" | "VENDEDOR" | "VISITANTE",
  email?: string,
) {
  return filterBillingNavTabsForRole(role, BILLING_NAV_TABS, email).map(
    (tab) => tab.label,
  );
}
