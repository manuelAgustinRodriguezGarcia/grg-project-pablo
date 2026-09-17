import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InvoiceSearchPicker } from "./InvoiceSearchPicker";

vi.mock("@/features/billing/styles/NewInvoice.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

const OPTIONS = [
  { id: "c1", title: "Cliente Uno", subtitle: "C-001 · CUIT" },
  { id: "c2", title: "Cliente Dos", subtitle: "C-002 · DNI" },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("InvoiceSearchPicker highlight", () => {
  it("destaca el primer cliente y no Agregar nuevo cliente cuando hay resultados", () => {
    render(
      <InvoiceSearchPicker
        inputId="invoice-client-picker"
        placeholder="Buscar"
        query=""
        options={OPTIONS}
        emptyText="Vacío"
        leadingAction={{ label: "Agregar nuevo cliente", onSelect: vi.fn() }}
        secondaryLeadingAction={{
          label: "Cliente sin identificación",
          onSelect: vi.fn(),
        }}
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));

    expect(screen.getByText("Cliente Uno").closest("button")).toHaveClass(
      "pickerOptionActive",
    );
    expect(
      screen.getByRole("button", { name: /Agregar nuevo cliente/ }),
    ).not.toHaveClass("pickerOptionActive");
  });

  it("destaca Agregar nuevo cliente cuando no hay resultados", () => {
    render(
      <InvoiceSearchPicker
        inputId="invoice-client-picker"
        placeholder="Buscar"
        query="zzz"
        options={[]}
        emptyText="Vacío"
        leadingAction={{ label: "Agregar nuevo cliente", onSelect: vi.fn() }}
        secondaryLeadingAction={{
          label: "Cliente sin identificación",
          onSelect: vi.fn(),
        }}
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));

    expect(
      screen.getByRole("button", { name: /Agregar nuevo cliente/ }),
    ).toHaveClass("pickerOptionActive");
  });

  it("Enter selecciona el cliente destacado, no la acción de alta", () => {
    const onSelect = vi.fn();
    const onCreate = vi.fn();

    render(
      <InvoiceSearchPicker
        inputId="invoice-client-picker"
        placeholder="Buscar"
        query=""
        options={OPTIONS}
        emptyText="Vacío"
        leadingAction={{ label: "Agregar nuevo cliente", onSelect: onCreate }}
        onQueryChange={vi.fn()}
        onSelect={onSelect}
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("c1");
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("navega en cruz entre los botones líderes y baja al primer cliente", () => {
    render(
      <InvoiceSearchPicker
        inputId="invoice-client-picker"
        placeholder="Buscar"
        query=""
        options={OPTIONS}
        emptyText="Vacío"
        leadingAction={{ label: "Agregar nuevo cliente", onSelect: vi.fn() }}
        secondaryLeadingAction={{
          label: "Cliente sin identificación",
          onSelect: vi.fn(),
        }}
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const input = screen.getByRole("combobox");
    const addClient = () =>
      screen.getByRole("button", { name: /Agregar nuevo cliente/ });
    const genericClient = () =>
      screen.getByRole("button", { name: /Cliente sin identificación/ });

    fireEvent.click(input);
    fireEvent.keyDown(input, { key: "ArrowUp" });

    expect(addClient()).toHaveClass("pickerOptionActive");
    expect(genericClient()).not.toHaveClass("pickerOptionActive");

    fireEvent.keyDown(input, { key: "ArrowRight" });

    expect(genericClient()).toHaveClass("pickerOptionActive");
    expect(addClient()).not.toHaveClass("pickerOptionActive");

    fireEvent.keyDown(input, { key: "ArrowLeft" });

    expect(addClient()).toHaveClass("pickerOptionActive");

    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(screen.getByText("Cliente Uno").closest("button")).toHaveClass(
      "pickerOptionActive",
    );
    expect(addClient()).not.toHaveClass("pickerOptionActive");
    expect(genericClient()).not.toHaveClass("pickerOptionActive");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowRight" });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(screen.getByText("Cliente Uno").closest("button")).toHaveClass(
      "pickerOptionActive",
    );
    expect(genericClient()).not.toHaveClass("pickerOptionActive");
  });

  it("Enter en un picker vacío selecciona la primera opción destacada", () => {
    const onLeaveEmpty = vi.fn();
    const onSelect = vi.fn();

    render(
      <InvoiceSearchPicker
        inputId="item-rubro-row-2"
        placeholder="Buscar"
        query=""
        options={OPTIONS}
        emptyText="Vacío"
        onQueryChange={vi.fn()}
        onSelect={onSelect}
        onLeaveEmpty={onLeaveEmpty}
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("c1");
    expect(onLeaveEmpty).not.toHaveBeenCalled();
  });

  it("Esc en un picker vacío dispara onLeaveEmpty", () => {
    const onLeaveEmpty = vi.fn();
    const onSelect = vi.fn();

    render(
      <InvoiceSearchPicker
        inputId="item-rubro-row-2"
        placeholder="Buscar"
        query=""
        options={OPTIONS}
        emptyText="Vacío"
        onQueryChange={vi.fn()}
        onSelect={onSelect}
        onLeaveEmpty={onLeaveEmpty}
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onLeaveEmpty).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("Enter selecciona el rubro si recorrieron el listado con flechas", () => {
    const onLeaveEmpty = vi.fn();
    const onSelect = vi.fn();

    render(
      <InvoiceSearchPicker
        inputId="item-rubro-row-2"
        placeholder="Buscar"
        query=""
        options={OPTIONS}
        emptyText="Vacío"
        onQueryChange={vi.fn()}
        onSelect={onSelect}
        onLeaveEmpty={onLeaveEmpty}
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("c2");
    expect(onLeaveEmpty).not.toHaveBeenCalled();
  });

  it("corre el scroll del listado para seguir la opción destacada", () => {
    const options = Array.from({ length: 8 }, (_, index) => ({
      id: `c${index}`,
      title: `Cliente ${index}`,
    }));

    render(
      <InvoiceSearchPicker
        inputId="invoice-client-picker"
        placeholder="Buscar"
        query=""
        options={options}
        emptyText="Vacío"
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.click(input);

    const list = screen.getByRole("listbox");
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.getAttribute("role") === "listbox") {
          return {
            x: 0,
            y: 0,
            width: 200,
            height: 100,
            top: 0,
            left: 0,
            right: 200,
            bottom: 100,
            toJSON: () => ({}),
          };
        }

        if (this.getAttribute("data-picker-highlighted") === "true") {
          return {
            x: 0,
            y: 140,
            width: 200,
            height: 40,
            top: 140,
            left: 0,
            right: 200,
            bottom: 180,
            toJSON: () => ({}),
          };
        }

        return {
          x: 0,
          y: 0,
          width: 200,
          height: 40,
          top: 0,
          left: 0,
          right: 200,
          bottom: 40,
          toJSON: () => ({}),
        };
      },
    );

    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(list.scrollTop).toBe(80);
  });

  it("Supr dispara onDeleteKey", () => {
    const onDeleteKey = vi.fn();
    render(
      <InvoiceSearchPicker
        inputId="invoice-rubro-picker"
        placeholder="Buscar"
        query="Embragues"
        options={OPTIONS}
        emptyText="Vacío"
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
        onDeleteKey={onDeleteKey}
      />,
    );

    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "Delete" });
    expect(onDeleteKey).toHaveBeenCalledTimes(1);
  });
});
