import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/billing/hooks/useBillingDocumentActivity", () => ({
  useBillingDocumentActivity: () => vi.fn(),
}));

vi.mock("@/features/admin/components/AdminSectionTransition", () => ({
  useAdminSectionTransition: () => null,
}));

vi.mock("@/features/billing/utils/invoice-pdf-client", () => ({
  downloadNotePdf: vi.fn(),
  downloadReceiptPdf: vi.fn(),
  getNotePdfFile: vi.fn(),
  getReceiptPdfFile: vi.fn(),
  notePdfFilename: () => "nota.pdf",
  printNotePdf: vi.fn(),
  printReceiptPdf: vi.fn(),
  receiptPdfFilename: () => "recibo.pdf",
  sharePdfFile: vi.fn(),
}));

import { BillingIssueSuccessModal } from "@/features/billing/components/BillingIssueSuccessModal";

vi.mock("@/features/billing/styles/ClientsManager.module.scss", () => ({
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));
vi.mock("@/features/prices/styles/PriceColumnEditModal.module.scss", () => ({
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

afterEach(() => {
  cleanup();
});

function renderModal(contact?: { clientWhatsapp?: string | null; clientEmail?: string | null }) {
  const onCreateAnother = vi.fn();
  const queryClient = new QueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <BillingIssueSuccessModal
        kind="DEBIT"
        embedded
        documentId="note-1"
        documentNumber="0007-00000001"
        meta="Nota de débito"
        clientWhatsapp={contact?.clientWhatsapp}
        clientEmail={contact?.clientEmail}
        onCreateAnother={onCreateAnother}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );

  return { onCreateAnother };
}

describe("BillingIssueSuccessModal", () => {
  it("N abre otra nota del mismo tipo", () => {
    const { onCreateAnother } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: /Crear nuevo/ }));
    fireEvent.keyDown(document, { key: "n", code: "KeyN" });

    expect(onCreateAnother).toHaveBeenCalledTimes(2);
  });

  it("deshabilita compartir cuando no hay teléfono ni mail", () => {
    renderModal();

    const share = screen.getByRole("button", { name: "Compartir" }) as HTMLButtonElement;
    expect(share.disabled).toBe(true);
    expect(share.querySelector("kbd")).toBeNull();

    fireEvent.keyDown(document, { key: "c", code: "KeyC" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("deja compartir si hay un mail", () => {
    renderModal({ clientEmail: "cliente@example.com" });

    const share = screen.getByRole("button", { name: /Compartir/ }) as HTMLButtonElement;
    expect(share.disabled).toBe(false);
    expect(share.textContent).toContain("C");
  });
});
