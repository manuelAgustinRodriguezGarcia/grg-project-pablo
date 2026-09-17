import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BillingPaymentMethod } from "@/generated/prisma/client";
import { InvoiceSummarySection } from "./InvoiceSummarySection";

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

function PaymentHarness({
  allowOnAccount = true,
}: {
  allowOnAccount?: boolean;
}) {
  const [paymentMethod, setPaymentMethod] =
    useState<BillingPaymentMethod>("CONTADO");

  return (
    <InvoiceSummarySection
      totals={null}
      invoiceType={null}
      ivaPercent={21}
      discountInput=""
      appliedDiscount={0}
      paymentMethod={paymentMethod}
      allowOnAccount={allowOnAccount}
      notes=""
      canSubmit={false}
      isSubmitting={false}
      blockingError={null}
      submitError={null}
      validationHints={[]}
      onDiscountInputChange={vi.fn()}
      onApplyDiscount={vi.fn()}
      onClearDiscount={vi.fn()}
      onPaymentMethodChange={setPaymentMethod}
      onNotesChange={vi.fn()}
      onSubmit={vi.fn()}
    />
  );
}

describe("InvoiceSummarySection payment keyboard", () => {
  it("navega con flechas y Enter confirma y pasa a observaciones", () => {
    render(<PaymentHarness />);

    const contado = screen.getByRole("radio", { name: "Contado" });
    contado.focus();
    fireEvent.keyDown(contado, { key: "ArrowRight" });

    const tarjeta = screen.getByRole("radio", { name: "Tarjeta" });
    expect(tarjeta).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(tarjeta, { key: "Enter" });
    expect(screen.getByLabelText(/Observaciones internas/)).toHaveFocus();
  });

  it("baja a cuenta corriente cuando está disponible", () => {
    render(<PaymentHarness />);

    const contado = screen.getByRole("radio", { name: "Contado" });
    contado.focus();
    fireEvent.keyDown(contado, { key: "ArrowDown" });
    fireEvent.keyDown(
      screen.getByRole("radio", { name: "Transferencia" }),
      { key: "ArrowDown" },
    );

    expect(
      screen.getByRole("radio", { name: "Cuenta corriente" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("Enter en observaciones avanza al descuento y no inserta un renglón", () => {
    const onNotesChange = vi.fn();

    render(
      <InvoiceSummarySection
        totals={null}
        invoiceType={null}
        ivaPercent={21}
        discountInput=""
        appliedDiscount={0}
        paymentMethod="CONTADO"
        allowOnAccount
        notes=""
        canSubmit={false}
        isSubmitting={false}
        blockingError={null}
        submitError={null}
        validationHints={[]}
        onDiscountInputChange={vi.fn()}
        onApplyDiscount={vi.fn()}
        onClearDiscount={vi.fn()}
        onPaymentMethodChange={vi.fn()}
        onNotesChange={onNotesChange}
        onSubmit={vi.fn()}
      />,
    );

    const notes = screen.getByLabelText(/Observaciones internas/);
    notes.focus();
    fireEvent.keyDown(notes, { key: "Enter" });

    expect(onNotesChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Porcentaje de descuento")).toHaveFocus();
  });
});

describe("InvoiceSummarySection discount and submit keyboard", () => {
  function renderSummary({
    discountInput = "",
    appliedDiscount = 0,
    canSubmit = true,
    onApplyDiscount = vi.fn(),
    onSubmit = vi.fn(),
  }: {
    discountInput?: string;
    appliedDiscount?: number;
    canSubmit?: boolean;
    onApplyDiscount?: ReturnType<typeof vi.fn>;
    onSubmit?: ReturnType<typeof vi.fn>;
  } = {}) {
    return {
      onApplyDiscount,
      onSubmit,
      ...render(
        <InvoiceSummarySection
          totals={null}
          invoiceType={null}
          ivaPercent={21}
          discountInput={discountInput}
          appliedDiscount={appliedDiscount}
          paymentMethod="CONTADO"
          allowOnAccount
          notes=""
          canSubmit={canSubmit}
          isSubmitting={false}
          blockingError={null}
          submitError={null}
          validationHints={[]}
          onDiscountInputChange={vi.fn()}
          onApplyDiscount={onApplyDiscount}
          onClearDiscount={vi.fn()}
          onPaymentMethodChange={vi.fn()}
          onNotesChange={vi.fn()}
          onSubmit={onSubmit}
        />,
      ),
    };
  }

  it("Enter en descuento vacío pasa a crear factura", () => {
    renderSummary();

    const discount = screen.getByLabelText("Porcentaje de descuento");
    discount.focus();
    fireEvent.keyDown(discount, { key: "Enter" });

    expect(
      screen.getByRole("button", { name: /Crear factura en modo prueba/ }),
    ).toHaveFocus();
  });

  it("Enter con descuento válido aplica y pasa a crear factura", () => {
    const { onApplyDiscount } = renderSummary({ discountInput: "5" });

    const discount = screen.getByLabelText("Porcentaje de descuento");
    discount.focus();
    fireEvent.keyDown(discount, { key: "Enter" });

    expect(onApplyDiscount).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: /Crear factura en modo prueba/ }),
    ).toHaveFocus();
  });

  it("Enter con descuento inválido no aplica ni avanza", () => {
    const { onApplyDiscount } = renderSummary({ discountInput: "abc" });

    const discount = screen.getByLabelText("Porcentaje de descuento");
    discount.focus();
    fireEvent.keyDown(discount, { key: "Enter" });

    expect(onApplyDiscount).not.toHaveBeenCalled();
    expect(discount).toHaveFocus();
  });
});
