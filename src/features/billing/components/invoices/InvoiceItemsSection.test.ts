import { describe, expect, it, vi } from "vitest";
import {
  itemRowPatchForRubroQuery,
  withoutTrailingEmptyDraftRows,
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

describe("itemRowPatchForRubroQuery", () => {
  it("al vaciar el rubro limpia detalle, cantidad y precio", () => {
    expect(itemRowPatchForRubroQuery("   ", true)).toEqual({
      rubroId: null,
      rubroCode: "",
      rubroName: "",
      rubroQuery: "",
      description: "",
      quantity: "1",
      unitPrice: "",
    });
  });

  it("si sigue buscando, solo suelta el rubro elegido", () => {
    expect(itemRowPatchForRubroQuery("cardan", true)).toEqual({
      rubroQuery: "cardan",
      rubroId: null,
      rubroCode: "",
      rubroName: "",
    });
  });
});

describe("withoutTrailingEmptyDraftRows", () => {
  const empty: InvoiceItemRow = {
    key: "empty",
    rubroId: null,
    rubroCode: "",
    rubroName: "",
    rubroQuery: "",
    description: "",
    quantity: "1",
    unitPrice: "",
  };
  const filled: InvoiceItemRow = {
    ...empty,
    key: "filled",
    rubroId: "r1",
    rubroQuery: "R1",
    description: "Detalle",
    unitPrice: "10",
  };

  it("quita la fila vacía del final si hay ítems cargados", () => {
    expect(withoutTrailingEmptyDraftRows([filled, empty]).map((row) => row.key)).toEqual(
      ["filled"],
    );
  });

  it("no deja la lista vacía", () => {
    expect(withoutTrailingEmptyDraftRows([empty])).toEqual([empty]);
  });
});
