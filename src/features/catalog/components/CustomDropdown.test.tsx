import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomDropdown } from "@/features/catalog/components/CustomDropdown";

const options = [
  { id: "general", label: "LISTA GENERAL" },
  { id: "mayorista", label: "LISTA MAYORISTA" },
  { id: "clientes", label: "LISTA CLIENTES ESPECIALES" },
];

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CustomDropdown searchable", () => {
  it("filtra, selecciona y limpia la búsqueda al cerrar", () => {
    const onSelect = vi.fn();

    render(
      <CustomDropdown
        label="Lista de precios"
        options={options}
        selectedId="general"
        onSelect={onSelect}
        searchable
        searchLabel="Buscar lista de precios"
        searchEmptyMessage="No se encontraron listas de precios"
      />,
    );

    expect(screen.getByText("LISTA GENERAL")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lista de precios" }));
    const search = screen.getByLabelText("Buscar lista de precios");
    fireEvent.change(search, { target: { value: "clientes" } });

    expect(screen.getByRole("option", { name: "LISTA CLIENTES ESPECIALES" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "LISTA GENERAL" })).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText("LISTA GENERAL")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "LISTA CLIENTES ESPECIALES" }));

    expect(onSelect).toHaveBeenCalledWith("clientes");
    expect(screen.queryByLabelText("Buscar lista de precios")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lista de precios" }));
    expect(screen.getByLabelText("Buscar lista de precios")).toHaveValue("");
    expect(screen.getByRole("option", { name: "LISTA MAYORISTA" })).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay coincidencias", () => {
    render(
      <CustomDropdown
        label="Lista de precios"
        options={options}
        selectedId="general"
        onSelect={vi.fn()}
        searchable
        searchLabel="Buscar lista de precios"
        searchEmptyMessage="No se encontraron listas de precios"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Lista de precios" }));
    fireEvent.change(screen.getByLabelText("Buscar lista de precios"), {
      target: { value: "inexistente" },
    });

    expect(screen.getByText("No se encontraron listas de precios")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});
