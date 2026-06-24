import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportCustomSelect } from "./ImportCustomSelect";

vi.mock("./ImportWizard.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

const OPTIONS = [
  { value: "__create__", label: "Crear columna nueva" },
  { value: "__ignore__", label: "Ignorar columna" },
];

describe("ImportCustomSelect", () => {
  afterEach(() => {
    cleanup();
  });

  it("muestra las opciones al abrir el dropdown", () => {
    render(
      <ImportCustomSelect
        options={OPTIONS}
        value="__create__"
        onChange={vi.fn()}
        listboxLabel="Destino"
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("option", { name: "Crear columna nueva" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ignorar columna" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("selecciona una opción", () => {
    const onChange = vi.fn();

    render(
      <ImportCustomSelect
        options={OPTIONS}
        value="__create__"
        onChange={onChange}
        listboxLabel="Destino"
      />,
    );

    fireEvent.click(screen.getByRole("button"));
    fireEvent.mouseDown(screen.getByRole("option", { name: "Ignorar columna" }));

    expect(onChange).toHaveBeenCalledWith("__ignore__");
  });
});
