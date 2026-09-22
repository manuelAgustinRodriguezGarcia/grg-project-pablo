import type {
  BillingClient,
  BillingFiscalSettings,
  BillingPaymentMethod,
  BillingRubro,
} from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/server/auth";
import { buildInvoicePdf } from "@/server/pdf/build-invoice-pdf";
import { resolveInvoicePdfIssuer } from "@/server/pdf/invoice-pdf-issuer";
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

export type CreateBillingInvoiceInput = {
  clientId: string;
  items: BillingInvoiceItemInput[];
  discountPercent?: number;
  paymentMethod: BillingPaymentMethod;
  notes?: string | null;
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

function requireTestEnvironment(settings: BillingFiscalSettings): void {
  if (settings.environment !== "MODO_PRUEBA") {
    throw new BillingInvoiceError(
      "La emisión fiscal con ARCA todavía no está disponible. Configure el ambiente en modo prueba.",
      "ENVIRONMENT_NOT_SUPPORTED",
    );
  }
}

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
  ): Promise<BillingInvoiceWithItems> {
    const { profile: admin } = await requirePermission("invoices.create");

    const items = sanitizeItems(input.items);
    const discountPercent = sanitizeDiscountPercent(input.discountPercent);
    const notes = sanitizeNotes(input.notes);

    const [client, settings, rubrosById] = await Promise.all([
      requireClient(input.clientId),
      billingFiscalSettingsRepository.getOrCreate(),
      requireActiveRubros(items.map((item) => item.rubroId)),
    ]);

    requireTestEnvironment(settings);

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

    const itemsData: CreateBillingInvoiceItemData[] = items.map(
      (item, index) => {
        const rubro = rubrosById.get(item.rubroId);

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
          lineTotal: centsToDecimal(totals.lineTotalsCents[index]),
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
      invoiceType,
      pointOfSale: settings.pointOfSale,
      clientId: client.id,
      clientCode: client.code,
      clientName: client.name,
      clientAddress: client.address,
      clientCity: client.city,
      clientProvince: client.province,
      clientEmail: client.email,
      clientWhatsapp: client.whatsapp,
      clientIdentificationType: client.identificationType,
      clientIdentificationNumber: client.identificationNumber,
      clientIvaCondition: client.ivaCondition,
      subtotal: centsToDecimal(totals.subtotalCents),
      discountPercent: new Prisma.Decimal(discountPercent),
      discountAmount: centsToDecimal(totals.discountCents),
      ivaPercent: new Prisma.Decimal(ivaPercent),
      ivaAmount: centsToDecimal(totals.ivaCents),
      total: centsToDecimal(totals.totalCents),
      totalVisualRounded: centsToDecimal(totals.totalVisualRoundedCents),
      paymentMethod: input.paymentMethod,
      paymentStatus: paymentStatusForMethod(input.paymentMethod),
      notes,
      items: itemsData,
    };

    const invoice = await this.createWithGeneratedNumber(invoiceData);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.BILLING_INVOICE_CREATED,
      entityType: AUDIT_ENTITY_TYPES.BILLING_INVOICE,
      entityId: invoice.id,
    });

    return invoice;
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

    const bytes = await buildInvoicePdf({
      invoiceType: invoice.invoiceType,
      invoiceNumber: invoice.invoiceNumber,
      pointOfSale: invoice.pointOfSale,
      issuedAt: invoice.issuedAt,
      environment: invoice.environment,
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
      issuer: resolveInvoicePdfIssuer(settings),
      logoPng,
    });

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
