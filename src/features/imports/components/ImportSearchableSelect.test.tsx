import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportSearchableSelect } from "./ImportSearchableSelect";

vi.mock("./ImportWizard.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

const OPTIONS = [
  { value: "a", label: "CÓDIGO DE CRAPODINAS" },
  { value: "b", label: "CÓDIGO DE IMÁGEN" },
  { value: "c", label: "TIPO DE ENGANCHE EN LA PLACA" },
];

describe("ImportSearchableSelect", () => {
  afterEach(() => {
    cleanup();
  });

  it("filtra opciones al escribir", () => {
    render(
      <ImportSearchableSelect
        options={OPTIONS}
        value="a"
        onChange={vi.fn()}
        listboxLabel="Columnas"
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "imagen" } });

    expect(screen.getByRole("option", { name: "CÓDIGO DE IMÁGEN" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "CÓDIGO DE CRAPODINAS" }),
    ).not.toBeInTheDocument();
  });

  it("selecciona una opción desde la lista", () => {
    const onChange = vi.fn();

    render(
      <ImportSearchableSelect
        options={OPTIONS}
        value="a"
        onChange={onChange}
        listboxLabel="Columnas"
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByRole("option", { name: "TIPO DE ENGANCHE EN LA PLACA" }));

    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("mantiene el valor seleccionado al filtrar sin elegir otra opción", () => {
    const onChange = vi.fn();

    render(
      <ImportSearchableSelect
        options={OPTIONS}
        value="a"
        onChange={onChange}
        listboxLabel="Columnas"
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "imagen" } });

    expect(onChange).not.toHaveBeenCalled();
  });
});
