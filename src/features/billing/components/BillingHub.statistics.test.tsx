import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BILLING_CLIENTS_PATH } from "@/features/billing/data/billingNav";
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
  it("abre el modal de clientes y el de rubros", () => {
    render(
      <BillingHub
        userRole="ADMINISTRADOR"
        userEmail="agencygrg@gmail.com"
      />,
    );

    expect(
      screen.queryByRole("link", { name: "Ver todos los clientes" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver estadísticas clientes" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Estadísticas de clientes" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /facturación|Evolución mensual/ })).toHaveLength(3);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Ver estadísticas rubros" }),
    );
    expect(
      screen.getByRole("link", { name: "Distribución de facturación" }),
    ).toHaveAttribute(
      "href",
      "/admin/facturacion/estadisticas?seccion=rubros&analisis=participacion",
    );
  });

  it("no muestra accesos de estadísticas a otro administrador", () => {
    render(
      <BillingHub userRole="ADMINISTRADOR" userEmail="otro@rothamel.com" />,
    );

    expect(
      screen.queryByRole("button", { name: /Ver estadísticas/ }),
    ).not.toBeInTheDocument();
  });

  it("no muestra accesos de estadísticas a quien no tiene permiso", () => {
    render(<BillingHub userRole="VENDEDOR" />);

    expect(
      screen.queryByRole("button", { name: /Ver estadísticas/ }),
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
