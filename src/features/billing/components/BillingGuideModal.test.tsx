import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BillingGuideModal } from "./BillingGuideModal";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("BillingGuideModal", () => {
  it("navigates home, category, article and back", () => {
    render(
      <BillingGuideModal userRole="ADMINISTRADOR" onClose={vi.fn()} />,
    );

    expect(
      screen.getByRole("heading", { name: "Guía de Facturación" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Facturas/ }));
    expect(
      screen.getByRole("heading", { name: "Facturas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /¿Cómo busco una factura\?/ }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /¿Cómo imprimo una factura\?/ }),
    );
    expect(
      screen.getByRole("heading", { name: "¿Cómo imprimo una factura?" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Volver/ }));
    expect(
      screen.getByRole("heading", { name: "Facturas" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Volver/ }));
    expect(
      screen.getByRole("heading", { name: "Guía de Facturación" }),
    ).toBeInTheDocument();
  });

  it("hides create-rubro guidance without categories.update", () => {
    render(
      <BillingGuideModal userRole="VISITANTE_AVANZADO" onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Rubros/ }));
    expect(
      screen.queryByRole("button", { name: /¿Cómo creo un nuevo rubro\?/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "No hay artículos disponibles para tu usuario en esta sección.",
      ),
    ).toBeInTheDocument();
  });

  it("closes from the home screen", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<BillingGuideModal userRole="ADMINISTRADOR" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    vi.advanceTimersByTime(180);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes with Escape from a nested screen", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<BillingGuideModal userRole="ADMINISTRADOR" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /Facturas/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    vi.advanceTimersByTime(180);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a friendly empty state when a category has no articles", () => {
    render(
      <BillingGuideModal userRole="ADMINISTRADOR" onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Libro IVA/ }));
    expect(
      screen.getByRole("heading", { name: "Libro IVA" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Todavía no hay guías disponibles en esta sección."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("returns to home after closing and opening again", () => {
    const { unmount } = render(
      <BillingGuideModal userRole="ADMINISTRADOR" onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Facturas/ }));
    expect(
      screen.getByRole("heading", { name: "Facturas" }),
    ).toBeInTheDocument();

    unmount();
    render(<BillingGuideModal userRole="ADMINISTRADOR" onClose={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Guía de Facturación" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Facturas" }),
    ).not.toBeInTheDocument();
  });
});
