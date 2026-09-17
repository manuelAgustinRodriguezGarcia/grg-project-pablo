import { describe, expect, it } from "vitest";
import { INVOICE_CREATE_PAYMENT_METHODS } from "@/features/billing/types/billing-invoice.types";
import {
  buildPickerHighlightItems,
  firstIncompleteItemField,
  initialPickerHighlightIndex,
  isInvoiceFlowEnter,
  isInvoiceItemDeleteKey,
  isInvoiceSubmitShortcut,
  isInvoiceAddItemShortcut,
  nextOverflowScrollTop,
  resolveAddItemShortcut,
  resolveDiscountEnter,
  resolvePickerHighlightMove,
  resolvePaymentMethodMove,
  resolvePriceEnter,
  resolveQuantityEnter,
  shouldLeaveEmptyPicker,
  type InvoiceKeyboardRowSnapshot,
} from "@/features/billing/utils/invoice-keyboard-flow";

function row(
  overrides: Partial<InvoiceKeyboardRowSnapshot> & { key: string },
): InvoiceKeyboardRowSnapshot {
  return {
    hasRubro: false,
    quantityValid: true,
    priceValid: false,
    isEmptyDraft: true,
    ...overrides,
  };
}

function enterEvent(
  overrides: Partial<{
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    isComposing: boolean;
  }> = {},
) {
  return {
    key: "Enter",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    ...overrides,
  };
}

describe("initialPickerHighlightIndex", () => {
  it("destaca el primer cliente cuando hay resultados", () => {
    const items = buildPickerHighlightItems(true, true, ["c1", "c2"]);

    expect(items[initialPickerHighlightIndex(items)]).toEqual({
      type: "option",
      id: "c1",
    });
  });

  it("destaca Agregar nuevo cliente cuando no hay resultados", () => {
    const items = buildPickerHighlightItems(true, true, []);

    expect(items[initialPickerHighlightIndex(items)]).toEqual({
      type: "leading",
    });
  });

  it("destaca el primer rubro si no hay acciones líderes", () => {
    const items = buildPickerHighlightItems(false, false, ["r1"]);

    expect(initialPickerHighlightIndex(items)).toBe(0);
  });
});

describe("resolvePickerHighlightMove", () => {
  const splitItems = buildPickerHighlightItems(true, true, ["c1", "c2"]);
  const leadingIndex = 0;
  const secondaryIndex = 1;
  const firstClientIndex = 2;
  const secondClientIndex = 3;

  it("pasa de Agregar nuevo cliente a Cliente sin identificación con flecha derecha", () => {
    expect(
      resolvePickerHighlightMove(splitItems, leadingIndex, "ArrowRight"),
    ).toBe(secondaryIndex);
  });

  it("pasa de Cliente sin identificación a Agregar nuevo cliente con flecha izquierda", () => {
    expect(
      resolvePickerHighlightMove(splitItems, secondaryIndex, "ArrowLeft"),
    ).toBe(leadingIndex);
  });

  it("baja de cualquiera de los dos botones al primer cliente", () => {
    expect(
      resolvePickerHighlightMove(splitItems, leadingIndex, "ArrowDown"),
    ).toBe(firstClientIndex);
    expect(
      resolvePickerHighlightMove(splitItems, secondaryIndex, "ArrowDown"),
    ).toBe(firstClientIndex);
  });

  it("no envuelve izquierda en Agregar ni derecha en Cliente sin identificación", () => {
    expect(
      resolvePickerHighlightMove(splitItems, leadingIndex, "ArrowLeft"),
    ).toBe(leadingIndex);
    expect(
      resolvePickerHighlightMove(splitItems, secondaryIndex, "ArrowRight"),
    ).toBe(secondaryIndex);
  });

  it("sube del primer cliente al botón líder preferido", () => {
    expect(
      resolvePickerHighlightMove(
        splitItems,
        firstClientIndex,
        "ArrowUp",
        "leading",
      ),
    ).toBe(leadingIndex);
    expect(
      resolvePickerHighlightMove(
        splitItems,
        firstClientIndex,
        "ArrowUp",
        "secondary",
      ),
    ).toBe(secondaryIndex);
  });

  it("sigue recorriendo clientes en vertical sin saltar al otro botón", () => {
    expect(
      resolvePickerHighlightMove(splitItems, firstClientIndex, "ArrowDown"),
    ).toBe(secondClientIndex);
    expect(
      resolvePickerHighlightMove(splitItems, secondClientIndex, "ArrowUp"),
    ).toBe(firstClientIndex);
  });

  it("no mueve izquierda/derecha cuando el highlight está en un cliente", () => {
    expect(
      resolvePickerHighlightMove(splitItems, firstClientIndex, "ArrowRight"),
    ).toBe(firstClientIndex);
    expect(
      resolvePickerHighlightMove(splitItems, firstClientIndex, "ArrowLeft"),
    ).toBe(firstClientIndex);
  });

  it("baja al primer resultado si no hay fila partida de acciones", () => {
    const items = buildPickerHighlightItems(true, false, ["r1"]);

    expect(resolvePickerHighlightMove(items, 0, "ArrowDown")).toBe(1);
  });
});

describe("nextOverflowScrollTop", () => {
  it("baja el scroll si el item queda por debajo del contenedor", () => {
    expect(
      nextOverflowScrollTop(
        { scrollTop: 0, top: 0, bottom: 100 },
        { top: 80, bottom: 130 },
      ),
    ).toBe(30);
  });

  it("sube el scroll si el item queda por encima del contenedor", () => {
    expect(
      nextOverflowScrollTop(
        { scrollTop: 80, top: 0, bottom: 100 },
        { top: -20, bottom: 20 },
      ),
    ).toBe(60);
  });

  it("no mueve el scroll si el item ya es visible", () => {
    expect(
      nextOverflowScrollTop(
        { scrollTop: 40, top: 0, bottom: 100 },
        { top: 10, bottom: 50 },
      ),
    ).toBe(40);
  });

  it("respeta padding del viewport visible", () => {
    expect(
      nextOverflowScrollTop(
        { scrollTop: 0, top: 16, bottom: 84 },
        { top: 70, bottom: 100 },
      ),
    ).toBe(16);
  });
});

describe("shouldLeaveEmptyPicker", () => {
  it("permite salir con Esc si el buscador está vacío", () => {
    expect(shouldLeaveEmptyPicker("")).toBe(true);
    expect(shouldLeaveEmptyPicker("   ")).toBe(true);
  });

  it("no sale si hay texto de búsqueda", () => {
    expect(shouldLeaveEmptyPicker("filtro")).toBe(false);
  });
});

describe("resolvePaymentMethodMove", () => {
  const methods = INVOICE_CREATE_PAYMENT_METHODS;

  it("recorre la fila superior con izquierda y derecha", () => {
    expect(
      resolvePaymentMethodMove(methods, "CONTADO", "ArrowRight", true, 0)
        .method,
    ).toBe("TARJETA");
    expect(
      resolvePaymentMethodMove(methods, "TARJETA", "ArrowRight", true, 1)
        .method,
    ).toBe("CONTADO");
    expect(
      resolvePaymentMethodMove(methods, "TARJETA", "ArrowLeft", true, 1)
        .method,
    ).toBe("CONTADO");
  });

  it("baja en la misma columna y llega a cuenta corriente", () => {
    expect(
      resolvePaymentMethodMove(methods, "CONTADO", "ArrowDown", true, 0)
        .method,
    ).toBe("TRANSFERENCIA");
    expect(
      resolvePaymentMethodMove(methods, "TARJETA", "ArrowDown", true, 1)
        .method,
    ).toBe("OTROS");
    expect(
      resolvePaymentMethodMove(methods, "TRANSFERENCIA", "ArrowDown", true, 0)
        .method,
    ).toBe("CUENTA_CORRIENTE");
    expect(
      resolvePaymentMethodMove(methods, "OTROS", "ArrowDown", true, 1).method,
    ).toBe("CUENTA_CORRIENTE");
  });

  it("sube desde cuenta corriente a la columna preferida", () => {
    expect(
      resolvePaymentMethodMove(
        methods,
        "CUENTA_CORRIENTE",
        "ArrowUp",
        true,
        1,
      ).method,
    ).toBe("OTROS");
    expect(
      resolvePaymentMethodMove(
        methods,
        "CUENTA_CORRIENTE",
        "ArrowUp",
        true,
        0,
      ).method,
    ).toBe("TRANSFERENCIA");
  });

  it("omite cuenta corriente si no está disponible", () => {
    expect(
      resolvePaymentMethodMove(methods, "TRANSFERENCIA", "ArrowDown", false, 0)
        .method,
    ).toBe("CONTADO");
    expect(
      resolvePaymentMethodMove(methods, "OTROS", "ArrowDown", false, 1).method,
    ).toBe("TARJETA");
  });
});

describe("isInvoiceFlowEnter", () => {
  it("acepta Enter plano", () => {
    expect(isInvoiceFlowEnter(enterEvent())).toBe(true);
  });

  it("ignora Ctrl+Enter, Alt+Enter y composición IME", () => {
    expect(isInvoiceFlowEnter(enterEvent({ ctrlKey: true }))).toBe(false);
    expect(isInvoiceFlowEnter(enterEvent({ metaKey: true }))).toBe(false);
    expect(isInvoiceFlowEnter(enterEvent({ altKey: true }))).toBe(false);
    expect(isInvoiceFlowEnter(enterEvent({ isComposing: true }))).toBe(false);
    expect(isInvoiceFlowEnter(enterEvent({ key: "a" }))).toBe(false);
  });
});

describe("isInvoiceItemDeleteKey", () => {
  it("acepta Supr sin modificadores", () => {
    expect(
      isInvoiceItemDeleteKey({
        key: "Delete",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }),
    ).toBe(true);
  });

  it("rechaza Retroceso y atajos modificados", () => {
    expect(
      isInvoiceItemDeleteKey({
        key: "Backspace",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }),
    ).toBe(false);
    expect(
      isInvoiceItemDeleteKey({
        key: "Delete",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
      }),
    ).toBe(false);
    expect(
      isInvoiceItemDeleteKey({
        key: "Delete",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: true,
      }),
    ).toBe(false);
  });
});

describe("resolveQuantityEnter", () => {
  it("avanza a precio si la cantidad es válida", () => {
    expect(resolveQuantityEnter(true)).toBe("price");
  });

  it("se queda en cantidad si no es válida", () => {
    expect(resolveQuantityEnter(false)).toBe("stay");
  });
});

describe("firstIncompleteItemField", () => {
  it("prioriza rubro, cantidad y precio", () => {
    expect(
      firstIncompleteItemField(
        row({ key: "1", hasRubro: false, quantityValid: false, priceValid: false }),
      ),
    ).toBe("rubro");
    expect(
      firstIncompleteItemField(
        row({ key: "1", hasRubro: true, quantityValid: false, priceValid: false }),
      ),
    ).toBe("quantity");
    expect(
      firstIncompleteItemField(
        row({ key: "1", hasRubro: true, quantityValid: true, priceValid: false }),
      ),
    ).toBe("price");
    expect(
      firstIncompleteItemField(
        row({
          key: "1",
          hasRubro: true,
          quantityValid: true,
          priceValid: true,
          isEmptyDraft: false,
        }),
      ),
    ).toBeNull();
  });
});

describe("resolvePriceEnter", () => {
  it("enfoca el primer campo incompleto de la fila", () => {
    expect(
      resolvePriceEnter("a", [
        row({
          key: "a",
          hasRubro: true,
          quantityValid: false,
          priceValid: false,
          isEmptyDraft: false,
        }),
      ]),
    ).toEqual({ type: "focus", field: "quantity", rowKey: "a" });
  });

  it("agrega una fila vacía si la actual está completa y no hay otra vacía", () => {
    expect(
      resolvePriceEnter("a", [
        row({
          key: "a",
          hasRubro: true,
          quantityValid: true,
          priceValid: true,
          isEmptyDraft: false,
        }),
      ]),
    ).toEqual({ type: "add-empty-row" });
  });

  it("no pide otra fila si ya existe una vacía", () => {
    expect(
      resolvePriceEnter("a", [
        row({
          key: "a",
          hasRubro: true,
          quantityValid: true,
          priceValid: true,
          isEmptyDraft: false,
        }),
        row({ key: "b", isEmptyDraft: true }),
      ]),
    ).toEqual({ type: "focus-empty-rubro", rowKey: "b" });
  });

  it("repite Enter sobre una fila completa reutiliza la vacía existente", () => {
    const rows = [
      row({
        key: "a",
        hasRubro: true,
        quantityValid: true,
        priceValid: true,
        isEmptyDraft: false,
      }),
      row({ key: "b", isEmptyDraft: true }),
    ];

    expect(resolvePriceEnter("a", rows)).toEqual({
      type: "focus-empty-rubro",
      rowKey: "b",
    });
    expect(resolvePriceEnter("a", rows)).toEqual({
      type: "focus-empty-rubro",
      rowKey: "b",
    });
  });
});

describe("resolveDiscountEnter", () => {
  it("salta al siguiente campo si el descuento está vacío", () => {
    expect(resolveDiscountEnter("", false)).toBe("skip");
    expect(resolveDiscountEnter("   ", true)).toBe("skip");
  });

  it("aplica el descuento cuando hay un valor válido", () => {
    expect(resolveDiscountEnter("5", true)).toBe("apply");
  });

  it("se queda en el campo si el valor no se puede aplicar", () => {
    expect(resolveDiscountEnter("abc", false)).toBe("stay");
    expect(resolveDiscountEnter("0", false)).toBe("stay");
  });
});

describe("isInvoiceSubmitShortcut", () => {
  it("reconoce Shift+F sin otros modificadores", () => {
    expect(
      isInvoiceSubmitShortcut({
        key: "F",
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }),
    ).toBe(true);
  });

  it("ignora F sin Shift, combinaciones y repeticiones", () => {
    expect(
      isInvoiceSubmitShortcut({
        key: "F",
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }),
    ).toBe(false);
    expect(
      isInvoiceSubmitShortcut({
        key: "F",
        shiftKey: true,
        ctrlKey: true,
        metaKey: false,
        altKey: false,
      }),
    ).toBe(false);
    expect(
      isInvoiceSubmitShortcut({
        key: "F",
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        repeat: true,
      }),
    ).toBe(false);
  });
});

describe("isInvoiceAddItemShortcut", () => {
  it("acepta + y NumpadAdd sin modificadores de control", () => {
    expect(
      isInvoiceAddItemShortcut({
        key: "+",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }),
    ).toBe(true);
    expect(
      isInvoiceAddItemShortcut({
        key: "+",
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }),
    ).toBe(true);
    expect(
      isInvoiceAddItemShortcut({
        key: "Add",
        code: "NumpadAdd",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }),
    ).toBe(true);
    expect(
      isInvoiceAddItemShortcut({
        key: "+",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
      }),
    ).toBe(false);
  });
});

describe("resolveAddItemShortcut", () => {
  it("enfoca la fila vacía existente o pide agregar una nueva", () => {
    expect(
      resolveAddItemShortcut([
        row({
          key: "complete",
          hasRubro: true,
          quantityValid: true,
          priceValid: true,
          isEmptyDraft: false,
        }),
        row({ key: "empty", isEmptyDraft: true }),
      ]),
    ).toEqual({ type: "focus-empty-rubro", rowKey: "empty" });

    expect(
      resolveAddItemShortcut([
        row({
          key: "complete",
          hasRubro: true,
          quantityValid: true,
          priceValid: true,
          isEmptyDraft: false,
        }),
      ]),
    ).toEqual({ type: "add-empty-row" });
  });
});
