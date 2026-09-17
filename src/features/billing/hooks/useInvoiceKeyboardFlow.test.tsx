import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  withoutTrailingEmptyDraftRows,
  type InvoiceItemRow,
} from "@/features/billing/components/invoices/InvoiceItemsSection";
import { useInvoiceKeyboardFlow } from "./useInvoiceKeyboardFlow";
import {
  INVOICE_CLIENT_PICKER_ID,
  INVOICE_PAYMENT_METHOD_ID,
  invoiceItemDescriptionId,
  invoiceItemPriceId,
  invoiceItemQuantityId,
  invoiceItemRubroId,
} from "@/features/billing/utils/invoice-keyboard-flow";

afterEach(() => {
  cleanup();
});

function emptyRow(key: string): InvoiceItemRow {
  return {
    key,
    rubroId: null,
    rubroCode: "",
    rubroName: "",
    rubroQuery: "",
    description: "",
    quantity: "1",
    unitPrice: "",
  };
}

function completeRow(key: string): InvoiceItemRow {
  return {
    ...emptyRow(key),
    rubroId: "rubro-1",
    rubroCode: "R-1",
    rubroName: "Filtro",
    rubroQuery: "R-1 — Filtro",
    description: "Filtro de aceite",
    quantity: "1",
    unitPrice: "1500",
  };
}

function KeyboardHarness({
  initialRows,
  focusClient = false,
}: {
  initialRows: InvoiceItemRow[];
  focusClient?: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const keyboard = useInvoiceKeyboardFlow({
    rows,
    focusClientPickerWhen: focusClient,
    discardTrailingEmptyRows: () => {
      setRows((current) => withoutTrailingEmptyDraftRows(current));
    },
    addEmptyRow: () => {
      let createdKey = "";
      setRows((current) => {
        const existing = current.find(
          (row) =>
            row.rubroId === null &&
            row.rubroQuery.trim() === "" &&
            row.description.trim() === "" &&
            row.quantity.trim() === "1" &&
            row.unitPrice.trim() === "",
        );
        if (existing) {
          createdKey = existing.key;
          return current;
        }

        const next = emptyRow(`row-${current.length + 1}`);
        createdKey = next.key;
        return [...current, next];
      });
      return createdKey;
    },
  });

  return (
    <div>
      <input id={INVOICE_CLIENT_PICKER_ID} aria-label="Buscar cliente" />
      {rows.map((row) => (
        <div key={row.key}>
          <input
            id={invoiceItemRubroId(row.key)}
            aria-label={`Rubro ${row.key}`}
          />
          <input
            id={invoiceItemDescriptionId(row.key)}
            aria-label={`Detalle ${row.key}`}
            defaultValue={row.description}
            onKeyDown={(event) =>
              keyboard.handleDescriptionKeyDown(event, row.key)
            }
          />
          <input
            id={invoiceItemQuantityId(row.key)}
            aria-label={`Cantidad ${row.key}`}
            defaultValue={row.quantity}
            onKeyDown={(event) =>
              keyboard.handleQuantityKeyDown(event, row.key)
            }
          />
          <input
            id={invoiceItemPriceId(row.key)}
            aria-label={`Precio ${row.key}`}
            defaultValue={row.unitPrice}
            onKeyDown={(event) => keyboard.handlePriceKeyDown(event, row.key)}
          />
        </div>
      ))}
      <textarea aria-label="Observaciones internas" />
      <button type="button" id={INVOICE_PAYMENT_METHOD_ID}>
        Contado
      </button>
      <button type="button" onClick={() => keyboard.focusFirstRubro()}>
        seleccionar-cliente
      </button>
      <button
        type="button"
        onClick={() => keyboard.afterRubroSelected(rows[0]?.key ?? "")}
      >
        seleccionar-rubro
      </button>
      <button type="button" onClick={() => keyboard.leaveItemsSection()}>
        salir-rubros
      </button>
    </div>
  );
}

describe("useInvoiceKeyboardFlow", () => {
  it("tras seleccionar cliente enfoca el primer rubro", () => {
    render(<KeyboardHarness initialRows={[emptyRow("row-1")]} />);

    fireEvent.click(screen.getByRole("button", { name: "seleccionar-cliente" }));
    expect(screen.getByLabelText("Rubro row-1")).toHaveFocus();
  });

  it("tras seleccionar rubro enfoca Detalle", () => {
    render(<KeyboardHarness initialRows={[completeRow("row-1")]} />);

    fireEvent.click(screen.getByRole("button", { name: "seleccionar-rubro" }));
    expect(screen.getByLabelText("Detalle row-1")).toHaveFocus();
  });

  it("enfoca el buscador de cliente al montar", () => {
    render(<KeyboardHarness initialRows={[emptyRow("row-1")]} focusClient />);

    expect(screen.getByLabelText("Buscar cliente")).toHaveFocus();
  });

  it("Enter en Detalle pasa a Cantidad y Enter en Cantidad pasa a Precio", () => {
    render(<KeyboardHarness initialRows={[completeRow("row-1")]} />);

    const description = screen.getByLabelText("Detalle row-1");
    description.focus();
    fireEvent.keyDown(description, { key: "Enter" });
    expect(screen.getByLabelText("Cantidad row-1")).toHaveFocus();

    fireEvent.keyDown(screen.getByLabelText("Cantidad row-1"), { key: "Enter" });
    expect(screen.getByLabelText("Precio row-1")).toHaveFocus();
  });

  it("Enter en Precio agrega o enfoca la siguiente fila de rubro una sola vez", async () => {
    render(<KeyboardHarness initialRows={[completeRow("row-1")]} />);

    const price = screen.getByLabelText("Precio row-1");
    price.focus();
    fireEvent.keyDown(price, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByLabelText("Rubro row-2")).toHaveFocus();
    });

    fireEvent.keyDown(price, { key: "Enter" });
    await waitFor(() => {
      expect(screen.getByLabelText("Rubro row-2")).toHaveFocus();
    });
    expect(screen.getAllByLabelText(/Rubro /)).toHaveLength(2);
  });

  it("al salir de rubros quita la fila vacía final y enfoca el método de pago", () => {
    render(
      <KeyboardHarness initialRows={[completeRow("row-1"), emptyRow("row-2")]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "salir-rubros" }));
    expect(screen.getByRole("button", { name: "Contado" })).toHaveFocus();
    expect(screen.queryByLabelText("Rubro row-2")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Rubro row-1")).toBeInTheDocument();
  });

  it("Enter en observaciones no agrega otro ítem", () => {
    render(<KeyboardHarness initialRows={[completeRow("row-1")]} />);

    const notes = screen.getByLabelText("Observaciones internas");
    notes.focus();
    fireEvent.keyDown(notes, { key: "Enter" });

    expect(notes).toHaveFocus();
    expect(screen.queryByLabelText("Rubro row-2")).not.toBeInTheDocument();
  });
});
