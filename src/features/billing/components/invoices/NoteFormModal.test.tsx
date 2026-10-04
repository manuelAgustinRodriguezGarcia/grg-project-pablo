import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import { NoteFormModal } from "@/features/billing/components/invoices/NoteFormModal";
import { createBillingNoteAction } from "@/features/billing/actions/billing-note.actions";
import { issueBillingNoteAction } from "@/features/billing/actions/issue-billing-note.action";

vi.mock("@/features/billing/styles/ClientsManager.module.scss", () => ({
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));
vi.mock("@/features/prices/styles/PriceColumnEditModal.module.scss", () => ({
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));
vi.mock("@/features/billing/actions/billing-note.actions", () => ({
  createBillingNoteAction: vi.fn(),
}));
vi.mock("@/features/billing/actions/issue-billing-note.action", () => ({
  issueBillingNoteAction: vi.fn(),
}));
vi.mock("@/features/billing/components/BillingIssueSuccessModal", () => ({
  BillingIssueSuccessModal: ({
    documentNumber,
  }: {
    documentNumber: string;
  }) => <p>{documentNumber}</p>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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
    clientEmail: null,
    clientWhatsapp: null,
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
    paymentMethod: "CUENTA_CORRIENTE",
    paymentStatus: "PENDIENTE",
    notes: null,
    items: [],
    createdAt: new Date("2026-08-19T15:00:00"),
    outstandingAmount: 100,
    creditNoteCap: 80,
    receipts: [],
    billingNotes: [],
    printedAt: null,
    downloadedAt: null,
    sharedAt: null,
    ...overrides,
  };
}

function renderModal(
  environment: "MODO_PRUEBA" | "HOMOLOGACION" | "PRODUCCION",
  noteProductionEmissionEnabled = false,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const current = invoice(
    environment === "MODO_PRUEBA"
      ? {}
      : {
          environment,
          fiscalStatus: "AUTORIZADA",
          invoiceNumber: "0007-00000001",
        },
  );

  return render(
    <QueryClientProvider client={client}>
      <NoteFormModal
        mode={{ kind: "CREDIT", invoiceId: current.id }}
        invoices={[current]}
        fiscalEnvironment={environment}
        noteProductionEmissionEnabled={noteProductionEmissionEnabled}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

function fillNote() {
  fireEvent.change(screen.getByLabelText("Importe"), {
    target: { value: "50,00" },
  });
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Devolución parcial" },
  });
}

describe("NoteFormModal", () => {
  it("en MODO_PRUEBA conserva el flujo legacy", async () => {
    vi.mocked(createBillingNoteAction).mockResolvedValue({
      success: true,
      data: {
        id: "note-1",
        kind: "CREDIT",
        fiscalStatus: "INTERNA",
        environment: "MODO_PRUEBA",
        noteNumber: "0007-PRUEBA-NC-000000001",
        issuedAt: new Date(),
        invoiceId: "inv-1",
        invoiceNumber: "0007-PRUEBA-000000001",
        invoiceType: "B",
        amount: 50,
        netAmount: 41.32,
        ivaAmount: 8.68,
        reason: "Devolución parcial",
        clientId: "client-1",
        clientName: "Taller Méndez",
        clientCode: "C-0001",
        clientIdentificationType: "CUIT",
        clientIdentificationNumber: "30500010912",
        clientIvaCondition: "RESPONSABLE_INSCRIPTO",
        createdByName: "Pablo",
        printedAt: null,
        downloadedAt: null,
        sharedAt: null,
      },
    });
    renderModal("MODO_PRUEBA");
    fillNote();
    fireEvent.click(screen.getByRole("button", { name: "Emitir nota" }));

    expect(await screen.findByText("0007-PRUEBA-NC-000000001")).toBeTruthy();
    expect(createBillingNoteAction).toHaveBeenCalledTimes(1);
    expect(issueBillingNoteAction).not.toHaveBeenCalled();
  });

  it("en HOMOLOGACION muestra el aviso", () => {
    renderModal("HOMOLOGACION");

    expect(
      screen.getByText(/no tendrá validez fiscal de producción/i),
    ).toBeTruthy();
    expect(screen.getByText(/HOMOLOGACIÓN/)).toBeTruthy();
  });

  it("en HOMOLOGACION permite la emisión fiscal", async () => {
    vi.mocked(issueBillingNoteAction).mockResolvedValue({
      ok: true,
      note: {
        id: "note-1",
        kind: "CREDIT",
        noteNumber: "0007-00000012",
        fiscalStatus: "AUTORIZADA",
        environment: "HOMOLOGACION",
      },
    });
    renderModal("HOMOLOGACION");
    fillNote();
    fireEvent.click(screen.getByRole("button", { name: "Revisar emisión" }));
    fireEvent.click(screen.getByRole("button", { name: "Emitir en homologación" }));

    expect(await screen.findByText("0007-00000012")).toBeTruthy();
    expect(issueBillingNoteAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "CREDIT",
        invoiceId: "inv-1",
        reason: "Devolución parcial",
      }),
    );
    expect(createBillingNoteAction).not.toHaveBeenCalled();
  });

  it("en PRODUCCION con rollout apagado muestra el bloqueo", () => {
    renderModal("PRODUCCION", false);

    expect(
      screen.getByText(
        "La emisión fiscal de Notas de Crédito y Débito en producción todavía no está habilitada.",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Importe")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Revisar emisión" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("deshabilita el submit mientras procesa", async () => {
    let resolveAction: (value: Awaited<ReturnType<typeof issueBillingNoteAction>>) => void =
      () => undefined;
    vi.mocked(issueBillingNoteAction).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );
    renderModal("HOMOLOGACION");
    fillNote();
    fireEvent.click(screen.getByRole("button", { name: "Revisar emisión" }));
    fireEvent.click(screen.getByRole("button", { name: "Emitir en homologación" }));

    expect(
      (await screen.findByRole("button", { name: "Emitiendo…" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    resolveAction({
      ok: true,
      note: {
        id: "note-1",
        kind: "CREDIT",
        noteNumber: "0007-00000012",
        fiscalStatus: "AUTORIZADA",
        environment: "HOMOLOGACION",
      },
    });
    expect(await screen.findByText("0007-00000012")).toBeTruthy();
  });

  it("el success muestra el número autorizado", async () => {
    vi.mocked(issueBillingNoteAction).mockResolvedValue({
      ok: true,
      note: {
        id: "note-9",
        kind: "CREDIT",
        noteNumber: "0007-00000077",
        fiscalStatus: "AUTORIZADA",
        environment: "HOMOLOGACION",
      },
    });
    renderModal("HOMOLOGACION");
    fillNote();
    fireEvent.click(screen.getByRole("button", { name: "Revisar emisión" }));
    fireEvent.click(screen.getByRole("button", { name: "Emitir en homologación" }));

    expect(await screen.findByText("0007-00000077")).toBeTruthy();
  });

  it("un resultado ambiguo permite reintentar con la misma intención", async () => {
    vi.mocked(issueBillingNoteAction)
      .mockResolvedValueOnce({
        ok: false,
        code: "NETWORK_ERROR",
        message:
          "No se pudo confirmar todavía el resultado de ARCA. Podés reintentar la consulta sin crear otro comprobante.",
        retryable: true,
        emissionStatus: "ambiguous",
      })
      .mockResolvedValueOnce({
        ok: true,
        note: {
          id: "note-1",
          kind: "CREDIT",
          noteNumber: "0007-00000012",
          fiscalStatus: "AUTORIZADA",
          environment: "HOMOLOGACION",
        },
      });
    renderModal("HOMOLOGACION");
    fillNote();
    fireEvent.click(screen.getByRole("button", { name: "Revisar emisión" }));
    fireEvent.click(screen.getByRole("button", { name: "Emitir en homologación" }));
    expect(
      await screen.findByRole("button", { name: "Reintentar consulta" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar consulta" }));
    expect(await screen.findByText("0007-00000012")).toBeTruthy();

    const first = vi.mocked(issueBillingNoteAction).mock.calls[0]?.[0] as {
      idempotencyKey: string;
    };
    const second = vi.mocked(issueBillingNoteAction).mock.calls[1]?.[0] as {
      idempotencyKey: string;
    };
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
  });

  it("un rechazo muestra el error", async () => {
    vi.mocked(issueBillingNoteAction).mockResolvedValue({
      ok: false,
      code: "10016",
      message: "10016: El importe no es válido",
      retryable: false,
      emissionStatus: "rejected",
    });
    renderModal("HOMOLOGACION");
    fillNote();
    fireEvent.click(screen.getByRole("button", { name: "Revisar emisión" }));
    fireEvent.click(screen.getByRole("button", { name: "Emitir en homologación" }));

    expect(await screen.findByText("10016: El importe no es válido")).toBeTruthy();
    expect(screen.queryByText("0007-00000012")).toBeNull();
  });

  it("la nota de crédito conserva el máximo visible", () => {
    renderModal("HOMOLOGACION");

    expect((screen.getByLabelText("Disponible") as HTMLInputElement).value).toMatch(
      /80,00/,
    );
  });

  it("no permite modificar la intención mientras el submit está pendiente", async () => {
    vi.mocked(issueBillingNoteAction).mockImplementation(
      () => new Promise(() => undefined),
    );
    renderModal("HOMOLOGACION");
    fillNote();
    fireEvent.click(screen.getByRole("button", { name: "Revisar emisión" }));
    fireEvent.click(screen.getByRole("button", { name: "Emitir en homologación" }));

    expect(
      (await screen.findByRole("button", { name: "Volver" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.queryByLabelText("Importe")).toBeNull();
    expect(screen.queryByLabelText("Motivo")).toBeNull();
  });
});
