import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BILLING_CLIENTS_PATH,
  BILLING_CONFIGURATION_PATH,
  BILLING_DEBTORS_PATH,
  BILLING_LIBRO_IVA_RESUMENES_PATH,
  BILLING_LIBROS_IVA_PATH,
  BILLING_NEW_INVOICE_PATH,
  BILLING_NEW_INVOICE_SHORTCUT,
  BILLING_STATISTICS_PATH,
} from "@/features/billing/data/billingNav";
import { BillingPillNav } from "./BillingPillNav";

const navigation = vi.hoisted(() => ({
  pathname: "/admin/facturacion/clientes",
  push: vi.fn(),
}));

const unsavedDraftState = vi.hoisted(() => ({
  isInvoiceIssued: false,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/billing/components/invoices/UnsavedInvoiceDraftContext", () => ({
  useUnsavedInvoiceDraft: () => ({
    isInvoiceIssued: unsavedDraftState.isInvoiceIssued,
    setInvoiceIssued: vi.fn(),
    setDraftDirty: vi.fn(),
    requestLeave: () => false,
    interceptLeave: () => false,
    setLeaveBlockHandler: vi.fn(),
  }),
}));

vi.mock("@/features/billing/styles/BillingPillNav.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

afterEach(() => {
  navigation.pathname = BILLING_CLIENTS_PATH;
  navigation.push.mockReset();
  unsavedDraftState.isInvoiceIssued = false;
  cleanup();
});

function clientesMenuWrap() {
  return screen.getByRole("menu", { name: "Clientes" }).parentElement;
}

describe("BillingPillNav clientes menu", () => {
  it("renders Clientes as a plain link for vendedores", () => {
    render(<BillingPillNav userRole="VENDEDOR" />);

    const clientsLink = document.querySelector(
      `a[href="${BILLING_CLIENTS_PATH}"]`,
    );
    expect(clientsLink).toHaveTextContent("Clientes");
    expect(clientsLink).not.toHaveAttribute("aria-haspopup");
    expect(
      screen.queryByRole("menu", { name: "Clientes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Lista de clientes" }),
    ).not.toBeInTheDocument();
  });

  it("exposes lista de clientes and lista de deudores under Clientes", () => {
    render(<BillingPillNav userRole="ADMINISTRADOR" />);

    const clientsOption = screen.getByRole("menuitem", {
      name: "Lista de clientes",
    });
    const debtorsOption = screen.getByRole("menuitem", {
      name: "Clientes con deuda",
    });

    expect(clientsOption).toHaveAttribute("href", BILLING_CLIENTS_PATH);
    expect(debtorsOption).toHaveAttribute("href", BILLING_DEBTORS_PATH);
  });

  it("keeps the clientes menu closed until hover", () => {
    render(<BillingPillNav userRole="ADMINISTRADOR" />);

    const wrap = clientesMenuWrap();
    expect(wrap).not.toHaveClass("tabWrapOpen");

    fireEvent.pointerEnter(wrap!);
    expect(wrap).toHaveClass("tabWrapOpen");
  });

  it("does not open the clientes menu when deudores loads", () => {
    navigation.pathname = BILLING_DEBTORS_PATH;
    render(<BillingPillNav userRole="ADMINISTRADOR" />);

    expect(clientesMenuWrap()).not.toHaveClass("tabWrapOpen");
  });

  it("closes the menu after choosing lista de deudores", () => {
    render(<BillingPillNav userRole="ADMINISTRADOR" />);

    const wrap = clientesMenuWrap();
    fireEvent.pointerEnter(wrap!);
    fireEvent.click(screen.getByRole("menuitem", { name: "Clientes con deuda" }));

    expect(wrap).not.toHaveClass("tabWrapOpen");
  });

  it("closes the menu when the route changes to deudores", () => {
    const { rerender } = render(<BillingPillNav userRole="ADMINISTRADOR" />);
    const wrap = clientesMenuWrap();
    fireEvent.pointerEnter(wrap!);
    expect(wrap).toHaveClass("tabWrapOpen");

    navigation.pathname = BILLING_DEBTORS_PATH;
    rerender(<BillingPillNav userRole="ADMINISTRADOR" />);

    expect(clientesMenuWrap()).not.toHaveClass("tabWrapOpen");
  });
});

function desktopTabLabels(): string[] {
  const list = screen.getByRole("list");
  return [...list.children].map((child) => {
    const link =
      child instanceof HTMLAnchorElement ? child : child.querySelector("a");
    return link?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  });
}

describe("BillingPillNav navegación definitiva", () => {
  it("muestra las siete pestañas en orden y conserva los accesos secundarios", () => {
    render(<BillingPillNav userRole="ADMINISTRADOR" />);

    expect(desktopTabLabels()).toEqual([
      "Resumen",
      "Clientes",
      "Rubros",
      "Facturas",
      "Movimientos",
      "Estadísticas",
      "Libros de IVA",
    ]);
    expect(screen.getByRole("listbox").textContent).toContain("Estadísticas");
    expect(screen.getByRole("listbox").textContent).toContain("Libros de IVA");
    expect(screen.queryByRole("menuitem", { name: "Generar libro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Resúmenes" })).not.toBeInTheDocument();

    const settings = screen.getByRole("link", { name: "Configuración" });
    const newInvoice = screen.getByRole("link", { name: /Nueva factura/ });
    expect(settings).toHaveAttribute("href", BILLING_CONFIGURATION_PATH);
    expect(settings.closest("[role='list']")).toBeNull();
    expect(newInvoice).toHaveAttribute("href", BILLING_NEW_INVOICE_PATH);
    expect(newInvoice.closest("[role='list']")).toBeNull();
    expect(
      document.querySelector(`a[href="${BILLING_LIBROS_IVA_PATH}"]`),
    ).toHaveTextContent("Libros de IVA");
    expect(
      document.querySelector(`a[href="${BILLING_STATISTICS_PATH}"]`),
    ).toHaveTextContent("Estadísticas");
    expect(screen.getByRole("option", { name: "Estadísticas" })).toHaveAttribute(
      "href",
      BILLING_STATISTICS_PATH,
    );
  });

  it("oculta estadísticas y configuración a vendedor y visitante", () => {
    render(<BillingPillNav userRole="VENDEDOR" />);

    expect(desktopTabLabels()).toEqual([
      "Clientes",
      "Facturas",
    ]);
    expect(screen.getByRole("link", { name: /Nueva factura/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Resúmenes" })).not.toBeInTheDocument();
    expect(
      document.querySelector(`a[href="${BILLING_LIBROS_IVA_PATH}"]`),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(`a[href="${BILLING_STATISTICS_PATH}"]`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Configuración" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("listbox").textContent).not.toContain("Estadísticas");

    cleanup();
    render(<BillingPillNav userRole="VISITANTE" />);
    expect(
      document.querySelector(`a[href="${BILLING_STATISTICS_PATH}"]`),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(`a[href="${BILLING_LIBROS_IVA_PATH}"]`),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Nueva factura/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Configuración" }),
    ).not.toBeInTheDocument();
  });

  it("muestra estadísticas y configuración al visitante avanzado", () => {
    render(<BillingPillNav userRole="VISITANTE_AVANZADO" />);

    expect(desktopTabLabels()).toContain("Estadísticas");
    expect(desktopTabLabels()).toContain("Libros de IVA");
    expect(
      document.querySelector(`a[href="${BILLING_STATISTICS_PATH}"]`),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configuración" })).toHaveAttribute(
      "href",
      BILLING_CONFIGURATION_PATH,
    );
  });

  it("marca Estadísticas, Libros de IVA y Configuración como sección actual", () => {
    navigation.pathname = BILLING_STATISTICS_PATH;
    render(<BillingPillNav userRole="ADMINISTRADOR" />);
    expect(
      document.querySelector(`[role="list"] a[href="${BILLING_STATISTICS_PATH}"]`),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("option", { name: "Estadísticas" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    cleanup();
    navigation.pathname = BILLING_LIBROS_IVA_PATH;
    render(<BillingPillNav userRole="ADMINISTRADOR" />);
    const libros = document.querySelector(`a[href="${BILLING_LIBROS_IVA_PATH}"]`);
    expect(libros).toHaveClass("tabActive");
    expect(libros).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("menu", { name: "Libros de IVA" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Secciones de facturación" }),
    ).toHaveTextContent("Libros de IVA");

    cleanup();
    navigation.pathname = BILLING_LIBRO_IVA_RESUMENES_PATH;
    render(<BillingPillNav userRole="ADMINISTRADOR" />);
    expect(
      document.querySelector(`a[href="${BILLING_LIBROS_IVA_PATH}"]`),
    ).toHaveClass("tabActive");

    cleanup();
    navigation.pathname = BILLING_CONFIGURATION_PATH;
    render(<BillingPillNav userRole="ADMINISTRADOR" />);
    expect(screen.getByRole("link", { name: "Configuración" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(desktopTabLabels().map((label) => label)).toEqual([
      "Resumen",
      "Clientes",
      "Rubros",
      "Facturas",
      "Movimientos",
      "Estadísticas",
      "Libros de IVA",
    ]);
    expect(
      screen.getByRole("list").querySelector("[aria-current='page']"),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Secciones de facturación" }),
    ).toHaveTextContent("Configuración");
  });
});

describe("BillingPillNav nueva factura shortcut", () => {
  it("muestra F2 junto a Nueva factura", () => {
    render(<BillingPillNav userRole="ADMINISTRADOR" />);

    expect(screen.getByRole("link", { name: /Nueva factura/ })).toHaveAttribute(
      "aria-keyshortcuts",
      BILLING_NEW_INVOICE_SHORTCUT,
    );
    expect(
      screen.getAllByText(BILLING_NEW_INVOICE_SHORTCUT).length,
    ).toBeGreaterThan(0);
  });

  it("F2 navega a nueva factura", () => {
    render(<BillingPillNav userRole="ADMINISTRADOR" />);

    fireEvent.keyDown(document, { key: BILLING_NEW_INVOICE_SHORTCUT });

    expect(navigation.push).toHaveBeenCalledWith(BILLING_NEW_INVOICE_PATH);
  });

  it("F2 no navega si ya está en nueva factura", () => {
    navigation.pathname = BILLING_NEW_INVOICE_PATH;
    render(<BillingPillNav userRole="ADMINISTRADOR" />);

    fireEvent.keyDown(document, { key: BILLING_NEW_INVOICE_SHORTCUT });

    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("dice Nueva factura cuando la factura ya fue creada", () => {
    navigation.pathname = BILLING_NEW_INVOICE_PATH;
    unsavedDraftState.isInvoiceIssued = true;
    render(<BillingPillNav userRole="ADMINISTRADOR" />);

    expect(
      screen.getByRole("link", { name: /Nueva factura/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Facturando/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nueva factura/ })).not.toHaveClass(
      "newInvoiceButtonCurrent",
    );
  });
});
