import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductSearchCombobox } from "./ProductSearchCombobox";

vi.mock("./ImportWizard.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

const OPTIONS = [
  { id: "p1", label: "R105-EMFREN 3204-FPM" },
  { id: "p2", label: "R106-EMFREN 3205-FPM" },
];

describe("ProductSearchCombobox", () => {
  afterEach(() => {
    cleanup();
  });

  it("filtra productos al escribir", () => {
    render(
      <ProductSearchCombobox
        options={OPTIONS}
        selectedId=""
        onSelect={vi.fn()}
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "3205" } });

    expect(screen.getByRole("option", { name: "R106-EMFREN 3205-FPM" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "R105-EMFREN 3204-FPM" })).not.toBeInTheDocument();
  });

  it("selecciona un producto desde la lista", () => {
    const onSelect = vi.fn();

    render(
      <ProductSearchCombobox
        options={OPTIONS}
        selectedId=""
        onSelect={onSelect}
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByRole("option", { name: "R105-EMFREN 3204-FPM" }));

    expect(onSelect).toHaveBeenCalledWith("p1");
  });
});
