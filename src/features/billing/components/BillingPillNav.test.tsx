import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BILLING_CLIENTS_PATH,
  BILLING_DEBTORS_PATH,
  BILLING_NEW_INVOICE_PATH,
  BILLING_NEW_INVOICE_SHORTCUT,
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
