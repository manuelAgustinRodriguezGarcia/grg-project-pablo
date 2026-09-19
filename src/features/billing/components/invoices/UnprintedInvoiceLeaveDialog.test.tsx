import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnprintedInvoiceLeaveDialog } from "./UnprintedInvoiceLeaveDialog";

vi.mock("@/features/catalog/styles/CatalogNavigator.module.scss", () => ({
  default: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

vi.mock("@/features/billing/styles/NewInvoice.module.scss", () => ({
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

describe("UnprintedInvoiceLeaveDialog", () => {
  it("Imprimir Factura e I disparan la impresión, Esc se queda", () => {
    const onPrint = vi.fn();
    const onLeave = vi.fn();
    const onStay = vi.fn();

    render(
      <UnprintedInvoiceLeaveDialog
        isPrinting={false}
        error={null}
        leaveAction={{ label: "Ir a facturas", shortcut: "L" }}
        onPrint={onPrint}
        onLeave={onLeave}
        onStay={onStay}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Imprimir Factura/ }));
    expect(onPrint).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "I" });
    expect(onPrint).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onStay).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("Ir a facturas y L continúan sin imprimir", () => {
    const onLeave = vi.fn();

    render(
      <UnprintedInvoiceLeaveDialog
        isPrinting={false}
        error={null}
        leaveAction={{ label: "Ir a facturas", shortcut: "L" }}
        onPrint={vi.fn()}
        onLeave={onLeave}
        onStay={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ir a facturas/ }));
    expect(onLeave).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "L" });
    expect(onLeave).toHaveBeenCalledTimes(2);
  });

  it("Crear nueva y F2 continúan sin imprimir", () => {
    const onLeave = vi.fn();

    render(
      <UnprintedInvoiceLeaveDialog
        isPrinting={false}
        error={null}
        leaveAction={{ label: "Crear nueva", shortcut: "F2" }}
        onPrint={vi.fn()}
        onLeave={onLeave}
        onStay={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Crear nueva/ }));
    expect(onLeave).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "F2" });
    expect(onLeave).toHaveBeenCalledTimes(2);
  });
});
