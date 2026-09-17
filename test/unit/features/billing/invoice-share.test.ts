import { describe, expect, it } from "vitest";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import {
  buildInvoiceShareCaption,
  buildInvoiceShareSubject,
  buildInvoiceShareText,
  buildMailtoShareUrl,
  buildWhatsAppShareUrl,
  getEmailShareLabel,
  getWhatsAppShareLabel,
  resolveLiveClientContact,
  toWhatsAppDigits,
} from "@/features/billing/utils/invoice-share";

function invoice(
  overrides: Partial<BillingInvoiceListItem> = {},
): BillingInvoiceListItem {
  return {
    id: "inv-1",
    environment: "MODO_PRUEBA",
    fiscalStatus: "MODO_PRUEBA",
    invoiceType: "B",
    pointOfSale: "0007",
    invoiceNumber: "0007-PRUEBA-000000001",
    issuedAt: new Date("2026-08-19T15:00:00"),
    clientId: "client-1",
    clientCode: "C-0001",
    clientName: "Taller Méndez",
    clientAddress: null,
    clientCity: null,
    clientProvince: null,
    clientEmail: "taller@mail.com",
    clientWhatsapp: "3492 123456",
    clientIdentificationType: "CUIT",
    clientIdentificationNumber: "30500010912",
    clientIvaCondition: "RESPONSABLE_INSCRIPTO",
    subtotal: 100,
    discountPercent: 0,
    discountAmount: 0,
    ivaPercent: 21,
    ivaAmount: 0,
    total: 100,
    totalVisualRounded: 100,
    paymentMethod: "CONTADO_EFECTIVO",
    paymentStatus: "PAGA",
    notes: null,
    items: [],
    createdAt: new Date("2026-08-19T15:00:00"),
    outstandingAmount: 0,
    creditNoteCap: 100,
    receipts: [],
    billingNotes: [],
    printedAt: null,
    downloadedAt: null,
    sharedAt: null,
    ...overrides,
  };
}

describe("toWhatsAppDigits", () => {
  it("agrega 54 si el número es local", () => {
    expect(toWhatsAppDigits("3492 123456")).toBe("543492123456");
  });

  it("conserva el 54 si ya está", () => {
    expect(toWhatsAppDigits("+54 9 3624 000000")).toBe("5493624000000");
  });

  it("devuelve null si no hay número usable", () => {
    expect(toWhatsAppDigits("123")).toBeNull();
    expect(toWhatsAppDigits(null)).toBeNull();
  });
});

describe("etiquetas de compartir", () => {
  it("muestra el destino cuando hay datos", () => {
    expect(getWhatsAppShareLabel("3492 123456")).toBe("Enviar a 3492 123456");
    expect(getEmailShareLabel("taller@mail.com")).toBe("Enviar a taller@mail.com");
  });

  it("deshabilita el copy si no hay datos", () => {
    expect(getWhatsAppShareLabel(null)).toBe("Enviar por WhatsApp");
    expect(getEmailShareLabel("")).toBe("Enviar por email");
  });
});

describe("resolveLiveClientContact", () => {
  it("usa el WhatsApp y el email actuales del cliente de esa factura", () => {
    const live = resolveLiveClientContact(
      invoice({
        clientId: "client-2",
        clientWhatsapp: "3492 111111",
        clientEmail: "viejo@mail.com",
      }),
      [
        {
          id: "client-1",
          whatsapp: "3492 000000",
          email: "primero@mail.com",
        },
        {
          id: "client-2",
          whatsapp: "3492 999999",
          email: "actual@mail.com",
        },
      ],
    );

    expect(live).toEqual({
      whatsapp: "3492 999999",
      email: "actual@mail.com",
    });
  });

  it("conserva el snapshot si no hay cliente asociado o no está en la lista", () => {
    const snapshot = invoice({
      clientId: null,
      clientWhatsapp: "3492 111111",
      clientEmail: "snapshot@mail.com",
    });

    expect(resolveLiveClientContact(snapshot, [])).toEqual({
      whatsapp: "3492 111111",
      email: "snapshot@mail.com",
    });
    expect(
      resolveLiveClientContact(
        invoice({
          clientId: "missing",
          clientWhatsapp: "3492 111111",
          clientEmail: "snapshot@mail.com",
        }),
        [{ id: "client-1", whatsapp: "3492 000000", email: "otro@mail.com" }],
      ),
    ).toEqual({
      whatsapp: "3492 111111",
      email: "snapshot@mail.com",
    });
  });
});

describe("texto y URLs de compartir", () => {
  it("incluye marca de modo prueba y arma wa.me / mailto", () => {
    const item = invoice();
    const text = buildInvoiceShareText(item);

    expect(text).toContain("0007-PRUEBA-000000001");
    expect(text).toContain("Taller Méndez");
    expect(text).toContain("MODO PRUEBA");
    expect(buildWhatsAppShareUrl("543492123456", "Hola")).toBe(
      "https://wa.me/543492123456?text=Hola",
    );
    expect(buildMailtoShareUrl("a@b.com", "Asunto", "Cuerpo")).toContain(
      "mailto:a@b.com?",
    );
    expect(buildInvoiceShareSubject(item)).toContain("Factura B");
    expect(buildInvoiceShareCaption(item)).toBe(
      "Factura B 0007-PRUEBA-000000001",
    );
  });
});
