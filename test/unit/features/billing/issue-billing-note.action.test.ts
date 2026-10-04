import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/server/auth/errors";
import { ArcaEmissionError } from "@/server/arca/errors/arca-emission.error";
import { issueArcaNote } from "@/server/arca/notes/issue-arca-note";
import { arcaEmissionRepository } from "@/server/arca/repositories/arca-emission.repository";
import { billingNoteRepository } from "@/server/repositories/billing-note.repository";
import { requirePermission } from "@/server/auth";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import { issueBillingNoteAction } from "@/features/billing/actions/issue-billing-note.action";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
  requirePermission: vi.fn(),
}));
vi.mock("@/server/arca/notes/issue-arca-note", () => ({
  issueArcaNote: vi.fn(),
}));
vi.mock("@/server/repositories/billing-note.repository", () => ({
  billingNoteRepository: { findById: vi.fn() },
}));
vi.mock("@/server/arca/repositories/arca-emission.repository", () => ({
  arcaEmissionRepository: { findById: vi.fn() },
}));

const input = {
  kind: "CREDIT" as const,
  invoiceId: "invoice-1",
  amount: 10.5,
  reason: "Devolución parcial",
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
};

describe("issueBillingNoteAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue({
      profile: { id: "user-from-session" },
    } as Awaited<ReturnType<typeof requirePermission>>);
  });

  it("requiere autenticación", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new AuthError("No autenticado", "UNAUTHENTICATED"),
    );

    const result = await issueBillingNoteAction(input);

    expect(result).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
      retryable: false,
    });
    expect(issueArcaNote).not.toHaveBeenCalled();
  });

  it("rechaza createdByUserId enviado por el cliente", async () => {
    vi.mocked(issueArcaNote).mockResolvedValue({
      status: "ambiguous",
      emissionId: "emission-1",
      voucherType: 8,
      voucherNumber: 1,
      code: "NETWORK_ERROR",
    });

    await issueBillingNoteAction({
      ...input,
      createdByUserId: "client-supplied-user",
    });

    expect(issueArcaNote).not.toHaveBeenCalled();
  });

  it("usa el usuario autenticado cuando el payload es válido", async () => {
    vi.mocked(issueArcaNote).mockResolvedValue({
      status: "ambiguous",
      emissionId: "emission-1",
      voucherType: 8,
      voucherNumber: 1,
      code: "NETWORK_ERROR",
    });

    await issueBillingNoteAction(input);

    expect(requirePermission).toHaveBeenCalledWith("movements.create");
    expect(issueArcaNote).toHaveBeenCalledWith(
      expect.objectContaining({
        createdByUserId: "user-from-session",
        amountCents: 1050,
        kind: "CREDIT",
        invoiceId: "invoice-1",
        reason: "Devolución parcial",
        idempotencyKey: input.idempotencyKey,
      }),
    );
  });

  it("no acepta voucherType desde el cliente", async () => {
    const result = await issueBillingNoteAction({
      ...input,
      voucherType: 8,
    });

    expect(result.ok).toBe(false);
    expect(issueArcaNote).not.toHaveBeenCalled();
  });

  it("no acepta environment desde el cliente", async () => {
    const result = await issueBillingNoteAction({
      ...input,
      environment: "PRODUCCION",
    });

    expect(result.ok).toBe(false);
    expect(issueArcaNote).not.toHaveBeenCalled();
  });

  it("transforma el importe a centavos", async () => {
    vi.mocked(issueArcaNote).mockResolvedValue({
      status: "rejected",
      emissionId: "emission-1",
      voucherType: 8,
      voucherNumber: 1,
    });
    vi.mocked(arcaEmissionRepository.findById).mockResolvedValue({
      errors: [],
    } as Awaited<ReturnType<typeof arcaEmissionRepository.findById>>);

    await issueBillingNoteAction({ ...input, amount: 1210.5 });

    expect(issueArcaNote).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 121050 }),
    );
  });

  it("delega la emisión en issueArcaNote", async () => {
    vi.mocked(issueArcaNote).mockResolvedValue({
      status: "completed",
      emissionId: "emission-1",
      noteId: "note-1",
      noteNumber: "0007-00000012",
      voucherType: 8,
      voucherNumber: 12,
      authorizationCode: "12345678901234",
      authorizationExpiresAt: "20261010",
      fiscalStatus: "AUTORIZADA",
      outstandingCents: 0,
    });
    vi.mocked(billingNoteRepository.findById).mockResolvedValue({
      id: "note-1",
      kind: "CREDIT",
      noteNumber: "0007-00000012",
      fiscalStatus: "AUTORIZADA",
      environment: "HOMOLOGACION",
    } as Awaited<ReturnType<typeof billingNoteRepository.findById>>);

    const result = await issueBillingNoteAction(input);

    expect(issueArcaNote).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      note: {
        id: "note-1",
        kind: "CREDIT",
        noteNumber: "0007-00000012",
        fiscalStatus: "AUTORIZADA",
        environment: "HOMOLOGACION",
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/12345678901234|token|sign|soap/i);
  });

  it("bloquea producción de notas cuando el rollout está apagado", async () => {
    vi.mocked(issueArcaNote).mockRejectedValue(
      new BillingInvoiceError(
        "La emisión fiscal de Notas de Crédito y Débito en producción todavía no está habilitada.",
        "NOTE_PRODUCTION_EMISSION_DISABLED",
      ),
    );

    const result = await issueBillingNoteAction(input);

    expect(result).toEqual({
      ok: false,
      code: "NOTE_PRODUCTION_EMISSION_DISABLED",
      message:
        "La emisión fiscal de Notas de Crédito y Débito en producción todavía no está habilitada.",
      retryable: false,
    });
  });

  it("devuelve el número autorizado en success", async () => {
    vi.mocked(issueArcaNote).mockResolvedValue({
      status: "completed",
      emissionId: "emission-1",
      noteId: "note-1",
      noteNumber: "0007-00000044",
      voucherType: 3,
      voucherNumber: 44,
      authorizationCode: "71234567890123",
      authorizationExpiresAt: null,
      fiscalStatus: "AUTORIZADA",
      outstandingCents: 100,
    });
    vi.mocked(billingNoteRepository.findById).mockResolvedValue({
      id: "note-1",
      kind: "CREDIT",
      noteNumber: "0007-00000044",
      fiscalStatus: "AUTORIZADA",
      environment: "HOMOLOGACION",
    } as Awaited<ReturnType<typeof billingNoteRepository.findById>>);

    const result = await issueBillingNoteAction(input);

    expect(result).toMatchObject({
      ok: true,
      note: { noteNumber: "0007-00000044" },
    });
  });

  it("devuelve ambigüedad recuperable", async () => {
    vi.mocked(issueArcaNote).mockResolvedValue({
      status: "ambiguous",
      emissionId: "emission-1",
      voucherType: 8,
      voucherNumber: 4,
      code: "NETWORK_ERROR",
    });

    const result = await issueBillingNoteAction(input);

    expect(result).toEqual({
      ok: false,
      code: "NETWORK_ERROR",
      message:
        "No se pudo confirmar todavía el resultado de ARCA. Podés reintentar la consulta sin crear otro comprobante.",
      retryable: true,
      emissionStatus: "ambiguous",
    });
  });

  it("devuelve el rechazo fiscal sanitizado", async () => {
    vi.mocked(issueArcaNote).mockResolvedValue({
      status: "rejected",
      emissionId: "emission-1",
      voucherType: 8,
      voucherNumber: 4,
    });
    vi.mocked(arcaEmissionRepository.findById).mockResolvedValue({
      errors: [{ code: "10016", message: "El importe no es válido" }],
    } as Awaited<ReturnType<typeof arcaEmissionRepository.findById>>);

    const result = await issueBillingNoteAction(input);

    expect(result).toMatchObject({
      ok: false,
      code: "10016",
      message: "10016: El importe no es válido",
      retryable: false,
      emissionStatus: "rejected",
    });
  });

  it("preserva el conflicto de idempotencia", async () => {
    vi.mocked(issueArcaNote).mockRejectedValue(
      new ArcaEmissionError(
        "La clave de idempotencia ya se usó con otros datos.",
        "ARCA_IDEMPOTENCY_CONFLICT",
      ),
    );

    const result = await issueBillingNoteAction(input);

    expect(result).toEqual({
      ok: false,
      code: "ARCA_IDEMPOTENCY_CONFLICT",
      message: "La clave de idempotencia ya se usó con otros datos.",
      retryable: false,
    });
  });
});
