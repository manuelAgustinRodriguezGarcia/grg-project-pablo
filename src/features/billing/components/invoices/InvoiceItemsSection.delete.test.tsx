import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InvoiceItemsSection,
  type InvoiceItemRow,
} from "./InvoiceItemsSection";

vi.mock("@/features/billing/styles/NewInvoice.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

vi.mock("@/features/catalog/styles/CatalogNavigator.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

afterEach(() => {
  cleanup();
});

function filledRow(key: string, name: string): InvoiceItemRow {
  return {
    key,
    rubroId: `rubro-${key}`,
    rubroCode: "R-1",
    rubroName: name,
    rubroQuery: `R-1 — ${name}`,
    description: name,
    quantity: "1",
    unitPrice: "100",
  };
}

describe("InvoiceItemsSection Delete", () => {
  it("Supr en un campo abre el confirm y Supr confirma el borrado", () => {
    const onRemoveRow = vi.fn();
    render(
      <InvoiceItemsSection
        rows={[filledRow("a", "Embragues"), filledRow("b", "Filtros")]}
        rubros={[]}
        ivaPercent={21}
        invoiceType="B"
        disabled={false}
        onRowChange={vi.fn()}
        onRowSelectRubro={vi.fn()}
        onAddRow={vi.fn()}
        onRemoveRow={onRemoveRow}
        onDescriptionKeyDown={vi.fn()}
        onQuantityKeyDown={vi.fn()}
        onPriceKeyDown={vi.fn()}
        onLeaveItemsSection={vi.fn()}
      />,
    );

    const price = screen.getByLabelText("Precio unitario con IVA ítem 1");
    price.focus();
    fireEvent.keyDown(price, { key: "Delete" });

    expect(
      screen.getByText("¿Quitar Embragues de esta factura?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Supr")).toBeInTheDocument();
    expect(screen.getByText("Esc")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Delete" });
    expect(onRemoveRow).toHaveBeenCalledWith("a");
  });

  it("Esc en el confirm cancela sin borrar", () => {
    const onRemoveRow = vi.fn();
    render(
      <InvoiceItemsSection
        rows={[filledRow("a", "Embragues"), filledRow("b", "Filtros")]}
        rubros={[]}
        ivaPercent={21}
        invoiceType="B"
        disabled={false}
        onRowChange={vi.fn()}
        onRowSelectRubro={vi.fn()}
        onAddRow={vi.fn()}
        onRemoveRow={onRemoveRow}
        onDescriptionKeyDown={vi.fn()}
        onQuantityKeyDown={vi.fn()}
        onPriceKeyDown={vi.fn()}
        onLeaveItemsSection={vi.fn()}
      />,
    );

    fireEvent.keyDown(screen.getByLabelText("Detalle ítem 2"), {
      key: "Delete",
    });
    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByText("¿Quitar Filtros de esta factura?"),
    ).not.toBeInTheDocument();
    expect(onRemoveRow).not.toHaveBeenCalled();
  });
});
