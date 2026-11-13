import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BILLING_CLIENTS_PATH, BILLING_STATISTICS_PATH } from "@/features/billing/data/billingNav";
import { BillingHub } from "./BillingHub";

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

vi.mock("@/features/billing/hooks/useBillingInvoicesQuery", () => ({
  useBillingInvoicesQuery: () => ({ data: [] }),
}));

afterEach(() => {
  cleanup();
});

describe("accesos de estadísticas en Resumen", () => {
  it("abre estadísticas y deja seleccionada la sección de clientes o rubros", () => {
    render(<BillingHub userRole="ADMINISTRADOR" />);

    expect(
      screen.queryByRole("link", { name: "Ver todos los clientes" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver estadísticas" })).toHaveAttribute(
      "href",
      BILLING_STATISTICS_PATH,
    );
    expect(
      screen.getByRole("link", { name: "Ver estadísticas clientes" }),
    ).toHaveAttribute("href", `${BILLING_STATISTICS_PATH}?seccion=clientes`);
    expect(
      screen.getByRole("link", { name: "Ver estadísticas rubros" }),
    ).toHaveAttribute("href", `${BILLING_STATISTICS_PATH}?seccion=rubros`);
  });

  it("muestra accesos de estadísticas al visitante avanzado", () => {
    render(<BillingHub userRole="VISITANTE_AVANZADO" />);

    expect(screen.getByRole("link", { name: "Ver estadísticas" })).toHaveAttribute(
      "href",
      BILLING_STATISTICS_PATH,
    );
  });

  it("no muestra accesos de estadísticas a quien no tiene permiso", () => {
    render(<BillingHub userRole="VENDEDOR" />);

    expect(
      screen.queryByRole("link", { name: /Ver estadísticas/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver todos los clientes" })).toHaveAttribute(
      "href",
      BILLING_CLIENTS_PATH,
    );
    expect(screen.getByRole("link", { name: "Ver todos los rubros" })).toHaveAttribute(
      "href",
      "/admin/facturacion/rubros",
    );
  });
});
