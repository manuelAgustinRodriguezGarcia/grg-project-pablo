import type {
  BillingClient,
  BillingFiscalSettings,
  BillingInvoiceType,
  BillingPaymentMethod,
  BillingRubro,
} from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaEmissionError } from "@/server/arca/errors/arca-emission.error";
import { getArcaCredentials } from "@/server/arca/config/credentials";
import { isArcaProductionEmissionEnabled } from "@/server/arca/config/production-emission";
import { finalizeApprovedArcaEmission } from "@/server/arca/invoices/finalize-approved-arca-emission";
import {
  issueArcaInvoice,
  type IssueArcaInvoiceResult,
} from "@/server/arca/invoices/issue-arca-invoice";
import { ArcaQrError } from "@/server/arca/qr/arca-qr.error";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";
import { normalizeIssuerCuit } from "@/server/arca/utils/cuit";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";
import { requirePermission } from "@/server/auth";
import { buildInvoicePdf } from "@/server/pdf/build-invoice-pdf";
import {
  resolveInvoicePdfIssuer,
  resolveStoredInvoicePdfIssuer,
} from "@/server/pdf/invoice-pdf-issuer";
import { loadRothamelLogoPng } from "@/server/pdf/load-rothamel-logo";
import {
  billingClientRepository,
} from "@/server/repositories/billing-client.repository";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import {
  billingInvoiceRepository,
  type BillingInvoiceWithItems,
  type CreateBillingInvoiceData,
  type CreateBillingInvoiceItemData,
} from "@/server/repositories/billing-invoice.repository";
import { billingRubroRepository } from "@/server/repositories/billing-rubro.repository";
import { getIssuerFiscalConfigurationStatus } from "@/features/billing/utils/issuer-fiscal-configuration";
import {
  PRODUCTION_CONFIGURATION_INCOMPLETE_MESSAGE,
  PRODUCTION_CREDENTIALS_UNAVAILABLE_MESSAGE,
  PRODUCTION_EMISSION_DISABLED_MESSAGE,
} from "@/shared/fiscal/production-emission";
import {
  buildTestInvoiceNumber,
  determineInvoiceType,
  isGenericBillingClient,
  canInvoiceUseOnAccountPayment,
  MAX_INVOICE_ITEM_QUANTITY,
  MAX_INVOICE_ITEM_UNIT_PRICE,
  paymentStatusForMethod,
} from "@/shared/utils/billing-invoice-rules";
import {
  computeInvoiceTotals,
  pesosToCents,
} from "@/shared/utils/billing-invoice-totals";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { buildArcaBillingPersistenceSnapshot } from "./billing-invoice-arca-snapshot";
import { BillingInvoiceError } from "./billing-invoice.errors";
import { releaseOverpaymentsForClient } from "./billing-invoice-settlement";

const NUMBER_GENERATION_MAX_ATTEMPTS = 5;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_NOTES_LENGTH = 1000;

export type BillingInvoiceItemInput = {
  rubroId: string;
  /** Sobrescribe la descripción del rubro solo para esta factura (PRD §9.4). */
  description?: string | null;
  quantity: number;
  /** Precio unitario en pesos, IVA incluido (PRD §14.3). */
  unitPrice: number;
};

const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ARCA_REJECTED_MESSAGE = "ARCA rechazó el comprobante.";
const ARCA_UNCERTAIN_MESSAGE =
  "No se pudo confirmar el estado del comprobante en ARCA. Volvé a intentar sin modificar la factura.";
const ARCA_PERSISTENCE_PENDING_MESSAGE =
  "ARCA autorizó el comprobante, pero no pudo completarse el guardado local. Volvé a intentar sin modificar la factura.";

export type CreateBillingInvoiceInput = {
  idempotencyKey: string;
  clientId: string;
  items: BillingInvoiceItemInput[];
  discountPercent?: number;
  paymentMethod: BillingPaymentMethod;
  notes?: string | null;
};

export type CreateBillingInvoiceOptions = {
  now?: Date;
};

function centsToDecimal(cents: number): Prisma.Decimal {
  return new Prisma.Decimal(cents).div(100);
}

function formatArsForMessage(cents: number): string {
  return (cents / 100).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function assertProductionEmissionReady(settings: BillingFiscalSettings): void {
  if (!isArcaProductionEmissionEnabled()) {
    throw new BillingInvoiceError(
      PRODUCTION_EMISSION_DISABLED_MESSAGE,
      "PRODUCTION_EMISSION_DISABLED",
    );
  }

  const readiness = getIssuerFiscalConfigurationStatus(settings);

  if (!readiness.complete) {
    throw new BillingInvoiceError(
      PRODUCTION_CONFIGURATION_INCOMPLETE_MESSAGE,
      "ARCA_PRODUCTION_CONFIGURATION_INCOMPLETE",
    );
  }

  try {
    getArcaCredentials("PRODUCCION");
  } catch (error) {
    if (error instanceof ArcaConfigurationError) {
      throw new BillingInvoiceError(
        PRODUCTION_CREDENTIALS_UNAVAILABLE_MESSAGE,
        "ARCA_CONFIGURATION_ERROR",
      );
    }

    throw error;
  }
}

function validationError(message: string): BillingInvoiceError {
  return new BillingInvoiceError(message, "VALIDATION_ERROR");
}

type SanitizedItem = {
  rubroId: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
};

function sanitizeItems(items: BillingInvoiceItemInput[]): SanitizedItem[] {
  if (items.length === 0) {
    throw validationError("La factura debe tener al menos un rubro.");
  }

  return items.map((item, index) => {
    const position = index + 1;

    if (!item.rubroId?.trim()) {
      throw validationError(`El ítem ${position} no tiene rubro asignado.`);
    }

    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw validationError(
        `El ítem ${position} debe tener una cantidad mayor a cero.`,
      );
    }

    if (item.quantity > MAX_INVOICE_ITEM_QUANTITY) {
      throw validationError(
        `La cantidad del ítem ${position} no puede superar ${MAX_INVOICE_ITEM_QUANTITY}.`,
      );
    }

    if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
      throw validationError(
        `El ítem ${position} debe tener un precio unitario mayor a cero.`,
      );
    }

    if (item.unitPrice > MAX_INVOICE_ITEM_UNIT_PRICE) {
      throw validationError(
        `El precio unitario del ítem ${position} no puede superar ${MAX_INVOICE_ITEM_UNIT_PRICE.toLocaleString("es-AR")}.`,
      );
    }

    const description = item.description?.trim() || null;

    if (description && description.length > MAX_DESCRIPTION_LENGTH) {
      throw validationError(
        `La descripción del ítem ${position} no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres.`,
      );
    }

    return {
      rubroId: item.rubroId.trim(),
      description,
      quantity: Math.round(item.quantity * 100) / 100,
      unitPriceCents: pesosToCents(item.unitPrice),
    };
  });
}

function sanitizeDiscountPercent(value: number | undefined): number {
  if (value === undefined || value === 0) {
    return 0;
  }

  if (!Number.isFinite(value) || value < 0 || value > 99.99) {
    throw validationError("El descuento debe estar entre 0% y 99,99%.");
  }

  return Math.round(value * 100) / 100;
}

function sanitizeNotes(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > MAX_NOTES_LENGTH) {
    throw validationError(
      `Las observaciones no pueden superar ${MAX_NOTES_LENGTH} caracteres.`,
    );
  }

  return trimmed;
}

async function requireClient(clientId: string): Promise<BillingClient> {
  const client = await billingClientRepository.findById(clientId);

  if (!client) {
    throw new BillingInvoiceError(
      "Cliente no encontrado.",
      "BILLING_CLIENT_NOT_FOUND",
    );
  }

  return client;
}

async function requireActiveRubros(
  rubroIds: string[],
): Promise<Map<string, BillingRubro>> {
  const uniqueIds = [...new Set(rubroIds)];
  const rubros = await billingRubroRepository.findByIds(uniqueIds);
  const rubrosById = new Map(rubros.map((rubro) => [rubro.id, rubro]));

  for (const id of uniqueIds) {
    const rubro = rubrosById.get(id);

    if (!rubro) {
      throw new BillingInvoiceError(
        "Uno de los rubros seleccionados no existe.",
        "BILLING_RUBRO_NOT_FOUND",
      );
    }

    if (rubro.status !== "ACTIVE") {
      throw new BillingInvoiceError(
        `El rubro ${rubro.name} está inactivo y no puede facturarse.`,
        "BILLING_RUBRO_INACTIVE",
      );
    }
  }

  return rubrosById;
}

function assertIdempotencyKey(value: string): string {
  const key = value.trim();

  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw validationError("La clave de idempotencia no es válida.");
  }

  return key;
}

function safePreSendMessage(message: string): string {
  const compact = message.replace(/\s+/g, " ").trim();

  if (
    !compact ||
    /token|sign|soap|certificate|private key/i.test(compact)
  ) {
    return "No se pudo preparar el comprobante.";
  }

  return compact.slice(0, 240);
}

type PreparedInvoice = {
  items: SanitizedItem[];
  discountPercent: number;
  notes: string | null;
  client: BillingClient;
  settings: BillingFiscalSettings;
  rubrosById: Map<string, BillingRubro>;
  invoiceType: BillingInvoiceType;
  ivaPercent: number;
  totals: ReturnType<typeof computeInvoiceTotals>;
  paymentMethod: BillingPaymentMethod;
};

export class BillingInvoiceService {
  async listInvoices(): Promise<BillingInvoiceWithItems[]> {
    await requirePermission("invoices.read");
    return billingInvoiceRepository.findAllOrdered();
  }

  async releaseClientOverpayments(clientId: string): Promise<void> {
    await requirePermission("invoices.update");
    await releaseOverpaymentsForClient(clientId);
  }

  async getInvoice(id: string): Promise<BillingInvoiceWithItems> {
    await requirePermission("invoices.read");
    const invoice = await billingInvoiceRepository.findById(id);

    if (!invoice) {
      throw new BillingInvoiceError(
        "Factura no encontrada.",
        "BILLING_INVOICE_NOT_FOUND",
      );
    }

    return invoice;
  }

  async createInvoice(
    input: CreateBillingInvoiceInput,
    options: CreateBillingInvoiceOptions = {},
  ): Promise<BillingInvoiceWithItems> {
    const { profile: admin } = await requirePermission("invoices.create");
    const idempotencyKey = assertIdempotencyKey(input.idempotencyKey);
    const prepared = await this.prepareInvoice(input);

    switch (prepared.settings.environment) {
      case "MODO_PRUEBA":
        return this.createTestInvoice(admin.id, prepared);
      case "HOMOLOGACION":
        return this.createArcaInvoice(
          admin.id,
          prepared,
          idempotencyKey,
          options.now ?? new Date(),
          "HOMOLOGACION",
        );
      case "PRODUCCION":
        assertProductionEmissionReady(prepared.settings);
        return this.createArcaInvoice(
          admin.id,
          prepared,
          idempotencyKey,
          options.now ?? new Date(),
          "PRODUCCION",
        );
      default: {
        const unexpected: never = prepared.settings.environment;
        return unexpected;
      }
    }
  }

  private async prepareInvoice(
    input: CreateBillingInvoiceInput,
  ): Promise<PreparedInvoice> {
    const items = sanitizeItems(input.items);
    const discountPercent = sanitizeDiscountPercent(input.discountPercent);
    const notes = sanitizeNotes(input.notes);

    const [client, settings, rubrosById] = await Promise.all([
      requireClient(input.clientId),
      billingFiscalSettingsRepository.getOrCreate(),
      requireActiveRubros(items.map((item) => item.rubroId)),
    ]);

    const invoiceType = determineInvoiceType(
      client.identificationType,
      client.ivaCondition,
    );
    const ivaPercent = settings.ivaPercent.toNumber();
    const totals = computeInvoiceTotals({
      invoiceType,
      items: items.map((item) => ({
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
      ivaPercent,
      discountPercent,
    });

    if (isGenericBillingClient(client)) {
      const limitCents = pesosToCents(settings.genericClientLimit.toNumber());

      if (totals.totalCents > limitCents) {
        throw new BillingInvoiceError(
          `El total supera el límite vigente de $${formatArsForMessage(limitCents)} para clientes sin identificación. Cargue los datos del cliente o reduzca el importe.`,
          "GENERIC_CLIENT_LIMIT_EXCEEDED",
        );
      }
    }

    if (
      input.paymentMethod === "CUENTA_CORRIENTE" &&
      !canInvoiceUseOnAccountPayment(client.identificationType)
    ) {
      throw new BillingInvoiceError(
        "La cuenta corriente no está disponible para clientes sin identificación.",
        "VALIDATION_ERROR",
      );
    }

    return {
      items,
      discountPercent,
      notes,
      client,
      settings,
      rubrosById,
      invoiceType,
      ivaPercent,
      totals,
      paymentMethod: input.paymentMethod,
    };
  }

  private async createTestInvoice(
    userId: string,
    prepared: PreparedInvoice,
  ): Promise<BillingInvoiceWithItems> {
    const itemsData: CreateBillingInvoiceItemData[] = prepared.items.map(
      (item, index) => {
        const rubro = prepared.rubrosById.get(item.rubroId);

        if (!rubro) {
          throw new BillingInvoiceError(
            "Uno de los rubros seleccionados no existe.",
            "BILLING_RUBRO_NOT_FOUND",
          );
        }

        return {
          rubroId: rubro.id,
          rubroCode: rubro.code,
          rubroName: rubro.name,
          description: item.description ?? rubro.description ?? rubro.name,
          quantity: new Prisma.Decimal(item.quantity),
          unitPrice: centsToDecimal(item.unitPriceCents),
          lineTotal: centsToDecimal(prepared.totals.lineTotalsCents[index]),
          sortOrder: index,
        };
      },
    );

    const invoiceData: Omit<
      CreateBillingInvoiceData,
      "sequenceNumber" | "invoiceNumber"
    > = {
      environment: "MODO_PRUEBA",
      fiscalStatus: "MODO_PRUEBA",
      invoiceType: prepared.invoiceType,
      pointOfSale: prepared.settings.pointOfSale,
      clientId: prepared.client.id,
      clientCode: prepared.client.code,
      clientName: prepared.client.name,
      clientAddress: prepared.client.address,
      clientCity: prepared.client.city,
      clientProvince: prepared.client.province,
      clientEmail: prepared.client.email,
      clientWhatsapp: prepared.client.whatsapp,
      clientIdentificationType: prepared.client.identificationType,
      clientIdentificationNumber: prepared.client.identificationNumber,
      clientIvaCondition: prepared.client.ivaCondition,
      subtotal: centsToDecimal(prepared.totals.subtotalCents),
      discountPercent: new Prisma.Decimal(prepared.discountPercent),
      discountAmount: centsToDecimal(prepared.totals.discountCents),
      ivaPercent: new Prisma.Decimal(prepared.ivaPercent),
      ivaAmount: centsToDecimal(prepared.totals.ivaCents),
      total: centsToDecimal(prepared.totals.totalCents),
      totalVisualRounded: centsToDecimal(
        prepared.totals.totalVisualRoundedCents,
      ),
      paymentMethod: prepared.paymentMethod,
      paymentStatus: paymentStatusForMethod(prepared.paymentMethod),
      notes: prepared.notes,
      items: itemsData,
    };

    const invoice = await this.createWithGeneratedNumber(invoiceData);
    this.auditCreated(userId, invoice.id);
    return invoice;
  }

  private async createArcaInvoice(
    userId: string,
    prepared: PreparedInvoice,
    idempotencyKey: string,
    issuedAt: Date,
    environment: ArcaEnvironment,
  ): Promise<BillingInvoiceWithItems> {
    let result: IssueArcaInvoiceResult;

    try {
      const pointOfSale = parseArcaPointOfSale(prepared.settings.pointOfSale);
      const issuerCuit = normalizeIssuerCuit(prepared.settings.issuerCuit);
      const billing = buildArcaBillingPersistenceSnapshot({
        issuedAt,
        pointOfSale,
        invoiceType: prepared.invoiceType,
        client: prepared.client,
        items: prepared.items,
        rubrosById: prepared.rubrosById,
        totals: prepared.totals,
        ivaPercent: prepared.ivaPercent,
        discountPercent: prepared.discountPercent,
        paymentMethod: prepared.paymentMethod,
        paymentStatus: paymentStatusForMethod(prepared.paymentMethod),
        notes: prepared.notes,
      });
      result = await issueArcaInvoice({
        idempotencyKey,
        environment,
        issuerCuit,
        pointOfSale,
        invoiceType: prepared.invoiceType,
        voucherDate: issuedAt,
        client: {
          identificationType: prepared.client.identificationType,
          identificationNumber: prepared.client.identificationNumber,
          ivaCondition: prepared.client.ivaCondition,
        },
        totals: {
          netCents: prepared.totals.netCents,
          vatCents: prepared.totals.ivaCents,
          totalCents: prepared.totals.totalCents,
          nonTaxedCents: 0,
          exemptCents: 0,
          taxCents: 0,
        },
        ivaPercent: prepared.ivaPercent,
        billing,
      });
    } catch (error) {
      if (error instanceof ArcaConfigurationError) {
        throw new BillingInvoiceError(
          safePreSendMessage(error.message),
          "ARCA_EMISSION_FAILED_PRE_SEND",
        );
      }

      if (error instanceof ArcaEmissionError) {
        throw new BillingInvoiceError(
          safePreSendMessage(error.message),
          "ARCA_EMISSION_FAILED_PRE_SEND",
        );
      }

      throw new BillingInvoiceError(
        "No se pudo preparar el comprobante.",
        "ARCA_EMISSION_FAILED_PRE_SEND",
      );
    }

    switch (result.status) {
      case "approved":
      case "completed":
        return this.persistApprovedEmission(userId, result.emissionId);
      case "rejected":
        throw new BillingInvoiceError(
          ARCA_REJECTED_MESSAGE,
          "ARCA_INVOICE_REJECTED",
        );
      case "ambiguous":
        throw new BillingInvoiceError(
          ARCA_UNCERTAIN_MESSAGE,
          "ARCA_EMISSION_STATUS_UNCERTAIN",
        );
      case "failed_pre_send":
        throw new BillingInvoiceError(
          safePreSendMessage(result.message),
          "ARCA_EMISSION_FAILED_PRE_SEND",
        );
      default: {
        const unexpected: never = result;
        return unexpected;
      }
    }
  }

  private async persistApprovedEmission(
    userId: string,
    emissionId: string,
  ): Promise<BillingInvoiceWithItems> {
    try {
      const finalized = await finalizeApprovedArcaEmission(emissionId);
      const invoice = await billingInvoiceRepository.findById(
        finalized.invoice.id,
      );

      if (!invoice) {
        throw new BillingInvoiceError(
          ARCA_PERSISTENCE_PENDING_MESSAGE,
          "ARCA_APPROVED_LOCAL_PERSISTENCE_PENDING",
        );
      }

      this.auditCreated(userId, invoice.id);
      return invoice;
    } catch (error) {
      if (
        error instanceof BillingInvoiceError &&
        error.code === "ARCA_APPROVED_LOCAL_PERSISTENCE_PENDING"
      ) {
        throw error;
      }

      throw new BillingInvoiceError(
        ARCA_PERSISTENCE_PENDING_MESSAGE,
        "ARCA_APPROVED_LOCAL_PERSISTENCE_PENDING",
      );
    }
  }

  private auditCreated(userId: string, invoiceId: string): void {
    auditService.logOperationSafe({
      userId,
      action: AUDIT_ACTIONS.BILLING_INVOICE_CREATED,
      entityType: AUDIT_ENTITY_TYPES.BILLING_INVOICE,
      entityId: invoiceId,
    });
  }

  async generateInvoicePdf(id: string): Promise<{
    bytes: Uint8Array;
    filename: string;
  }> {
    const [invoice, settings, logoPng] = await Promise.all([
      this.getInvoice(id),
      billingFiscalSettingsRepository.getOrCreate(),
      loadRothamelLogoPng(),
    ]);

    const fiscalPdf = invoice.environment !== "MODO_PRUEBA";

    let bytes: Uint8Array;

    try {
      bytes = await buildInvoicePdf({
        invoiceType: invoice.invoiceType,
        invoiceNumber: invoice.invoiceNumber,
        pointOfSale: invoice.pointOfSale,
        issuedAt: invoice.issuedAt,
        environment: invoice.environment,
        fiscalStatus: invoice.fiscalStatus,
        sequenceNumber: invoice.sequenceNumber,
        cae: invoice.cae,
        caeExpiresAt: invoice.caeExpiresAt,
        issuerPlaceholders: !fiscalPdf,
        clientName: invoice.clientName,
        clientCode: invoice.clientCode,
        clientAddress: invoice.clientAddress,
        clientCity: invoice.clientCity,
        clientProvince: invoice.clientProvince,
        clientIdentificationType: invoice.clientIdentificationType,
        clientIdentificationNumber: invoice.clientIdentificationNumber,
        clientIvaCondition: invoice.clientIvaCondition,
        items: invoice.items.map((item) => ({
          rubroCode: item.rubroCode,
          description: item.description,
          quantity: item.quantity.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
          lineTotal: item.lineTotal.toNumber(),
        })),
        subtotal: invoice.subtotal.toNumber(),
        discountPercent: invoice.discountPercent.toNumber(),
        discountAmount: invoice.discountAmount.toNumber(),
        ivaPercent: invoice.ivaPercent.toNumber(),
        ivaAmount: invoice.ivaAmount.toNumber(),
        total: invoice.total.toNumber(),
        totalVisualRounded: invoice.totalVisualRounded.toNumber(),
        paymentMethod: invoice.paymentMethod,
        notes: invoice.notes,
        issuer: fiscalPdf
          ? resolveStoredInvoicePdfIssuer(settings)
          : resolveInvoicePdfIssuer(settings),
        logoPng,
      });
    } catch (error) {
      if (error instanceof ArcaQrError) {
        throw new BillingInvoiceError(error.message, "ARCA_QR_DATA_INCOMPLETE");
      }

      throw error;
    }

    return {
      bytes,
      filename: `Factura-${invoice.invoiceNumber}.pdf`,
    };
  }

  private async createWithGeneratedNumber(
    data: Omit<CreateBillingInvoiceData, "sequenceNumber" | "invoiceNumber">,
  ): Promise<BillingInvoiceWithItems> {
    for (
      let attempt = 0;
      attempt < NUMBER_GENERATION_MAX_ATTEMPTS;
      attempt += 1
    ) {
      const sequenceNumber =
        await billingInvoiceRepository.getNextSequenceNumber(
          data.environment,
          data.pointOfSale,
        );

      try {
        return await billingInvoiceRepository.create({
          ...data,
          sequenceNumber,
          invoiceNumber: buildTestInvoiceNumber(
            data.pointOfSale,
            sequenceNumber,
          ),
        });
      } catch (error) {
        if (!billingInvoiceRepository.isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    throw new BillingInvoiceError(
      "No se pudo generar un número de factura único. Intente de nuevo.",
      "NUMBER_GENERATION_FAILED",
    );
  }
}

export const billingInvoiceService = new BillingInvoiceService();
