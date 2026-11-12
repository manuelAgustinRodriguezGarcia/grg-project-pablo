import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatisticsChoiceModal } from "./StatisticsChoiceModal";

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

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

function renderModal(section: "clientes" | "rubros" = "clientes") {
  const onClose = vi.fn();
  render(<StatisticsChoiceModal section={section} onClose={onClose} />);
  return onClose;
}

describe("StatisticsChoiceModal", () => {
  it("ofrece los análisis de clientes y navega al elegido", () => {
    renderModal("clientes");

    const dialog = screen.getByRole("dialog", { name: "Estadísticas de clientes" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(
      "Seleccioná el análisis que querés consultar.",
    );
    expect(screen.getByRole("heading", { name: "Estadísticas de clientes" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "Ranking por facturación" })).toHaveAttribute(
      "href",
      "/admin/facturacion/estadisticas?seccion=clientes&analisis=ranking",
    );
    expect(
      screen.getByRole("link", { name: "Participación en la facturación" }),
    ).toHaveAttribute(
      "href",
      "/admin/facturacion/estadisticas?seccion=clientes&analisis=participacion",
    );
    expect(screen.getByRole("link", { name: "Evolución mensual" })).toHaveAttribute(
      "href",
      "/admin/facturacion/estadisticas?seccion=clientes&analisis=evolucion",
    );
  });

  it("ofrece la distribución de rubros", () => {
    renderModal("rubros");

    expect(
      screen.getByRole("dialog", { name: "Estadísticas de rubros" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Distribución de facturación" })).toHaveAttribute(
      "href",
      "/admin/facturacion/estadisticas?seccion=rubros&analisis=participacion",
    );
    expect(
      screen.queryByRole("link", { name: "Participación en la facturación" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("se cierra con Escape, el botón y un clic fuera", () => {
    const onClose = renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(2);

    const overlay = screen.getByRole("dialog").parentElement;
    fireEvent.mouseDown(overlay!);
    expect(onClose).toHaveBeenCalledTimes(3);

    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("recorre el diálogo con el teclado", () => {
    renderModal();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("link", { name: "Evolución mensual" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
  });
});
