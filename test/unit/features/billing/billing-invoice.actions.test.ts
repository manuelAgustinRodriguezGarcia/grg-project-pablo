import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import { billingInvoiceService } from "@/server/services/billing-invoice.service";
import { createBillingInvoiceAction } from "@/features/billing/actions/billing-invoice.actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/server/services/billing-invoice.service", () => ({
  billingInvoiceService: {
    createInvoice: vi.fn(),
  },
}));
vi.mock("@/server/services/billing-fiscal-settings.service", () => ({
  billingFiscalSettingsService: {
    getSettings: vi.fn(),
  },
}));

const input = {
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  clientId: "client-1",
  items: [{ rubroId: "rubro-1", quantity: 1, unitPrice: 100 }],
  paymentMethod: "CONTADO_EFECTIVO",
};

describe("createBillingInvoiceAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [
      "ARCA_INVOICE_REJECTED",
      "ARCA rechazó el comprobante.",
    ],
    [
      "ARCA_EMISSION_STATUS_UNCERTAIN",
      "No se pudo confirmar el estado del comprobante en ARCA. Volvé a intentar sin modificar la factura.",
    ],
    [
      "ARCA_APPROVED_LOCAL_PERSISTENCE_PENDING",
      "ARCA autorizó el comprobante, pero no pudo completarse el guardado local. Volvé a intentar sin modificar la factura.",
    ],
    [
      "PRODUCTION_EMISSION_DISABLED",
      "La emisión en producción no está habilitada.",
    ],
  ] as const)("devuelve %s sin datos internos", async (code, message) => {
    vi.mocked(billingInvoiceService.createInvoice).mockRejectedValue(
      new BillingInvoiceError(message, code),
    );

    const result = await createBillingInvoiceAction(input);

    expect(result).toEqual({ success: false, error: message, code });
    expect(JSON.stringify(result)).not.toMatch(/token|sign|soap|stack/i);
  });

  it("no expone un error interno sin código", async () => {
    vi.mocked(billingInvoiceService.createInvoice).mockRejectedValue(
      new Error("SOAP token Sign private key"),
    );

    const result = await createBillingInvoiceAction(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Ocurrió un error inesperado. Inténtalo de nuevo.");
      expect(result.error).not.toMatch(/token|sign|soap/i);
    }
  });
});
