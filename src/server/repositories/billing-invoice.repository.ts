import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoice,
  BillingInvoiceFiscalStatus,
  BillingInvoiceItem,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingNote,
  BillingPaymentMethod,
  BillingPaymentStatus,
  BillingReceipt,
  BillingReceiptAllocation,
  User,
} from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

const invoiceListInclude = {
  items: { orderBy: { sortOrder: "asc" as const } },
  allocations: {
    orderBy: { createdAt: "desc" as const },
    include: {
      receipt: {
        include: { createdBy: { select: { name: true } } },
      },
    },
  },
  billingNotes: {
    orderBy: { issuedAt: "asc" as const },
    include: { createdBy: { select: { name: true } } },
  },
} satisfies Prisma.BillingInvoiceInclude;

export type BillingInvoiceWithItems = BillingInvoice & {
  items: BillingInvoiceItem[];
  allocations: Array<
    BillingReceiptAllocation & {
      receipt: BillingReceipt & { createdBy: Pick<User, "name"> };
    }
  >;
  billingNotes: Array<BillingNote & { createdBy: Pick<User, "name"> }>;
};

export type CreateBillingInvoiceItemData = {
  rubroId: string | null;
  rubroCode: string;
  rubroName: string;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  sortOrder: number;
};

export type CreateBillingInvoiceData = {
  environment: BillingFiscalEnvironment;
  fiscalStatus: BillingInvoiceFiscalStatus;
  invoiceType: BillingInvoiceType;
  pointOfSale: string;
  sequenceNumber: number;
  invoiceNumber: string;
  clientId: string;
  clientCode: string;
  clientName: string;
  clientAddress: string | null;
  clientCity: string | null;
  clientProvince: string | null;
  clientEmail: string | null;
  clientWhatsapp: string | null;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
  subtotal: Prisma.Decimal;
  discountPercent: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  ivaPercent: Prisma.Decimal;
  ivaAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  totalVisualRounded: Prisma.Decimal;
  paymentMethod: BillingPaymentMethod;
  paymentStatus: BillingPaymentStatus;
  notes: string | null;
  items: CreateBillingInvoiceItemData[];
  issuedAt?: Date;
  cae?: string;
  caeExpiresAt?: Date;
};

type InvoiceDb = Prisma.TransactionClient | typeof prisma;

export class BillingInvoiceRepository {
  async findAllOrdered(
    environment: BillingFiscalEnvironment,
  ): Promise<BillingInvoiceWithItems[]> {
    return prisma.billingInvoice.findMany({
      where: { environment },
      orderBy: [{ issuedAt: "desc" }, { sequenceNumber: "desc" }],
      include: {
        ...invoiceListInclude,
        billingNotes: {
          ...invoiceListInclude.billingNotes,
          where: { environment },
        },
      },
    });
  }

  async findById(
    id: string,
    db: InvoiceDb = prisma,
  ): Promise<BillingInvoiceWithItems | null> {
    return db.billingInvoice.findUnique({
      where: { id },
      include: invoiceListInclude,
    });
  }

  async findByIds(ids: string[]): Promise<BillingInvoiceWithItems[]> {
    if (ids.length === 0) {
      return [];
    }

    return prisma.billingInvoice.findMany({
      where: { id: { in: ids } },
      include: invoiceListInclude,
    });
  }

  async create(
    data: CreateBillingInvoiceData,
    db: InvoiceDb = prisma,
  ): Promise<BillingInvoiceWithItems> {
    const { items, issuedAt, cae, caeExpiresAt, ...invoice } = data;

    const created = await db.billingInvoice.create({
      data: {
        ...invoice,
        ...(issuedAt ? { issuedAt } : {}),
        ...(cae ? { cae } : {}),
        ...(caeExpiresAt ? { caeExpiresAt } : {}),
        items: { create: items },
      },
      select: { id: true },
    });

    const full = await db.billingInvoice.findUnique({
      where: { id: created.id },
      include: invoiceListInclude,
    });

    if (!full) {
      throw new Error("La factura creada no se pudo volver a cargar.");
    }

    return full;
  }

  async getNextSequenceNumber(
    environment: BillingFiscalEnvironment,
    pointOfSale: string,
  ): Promise<number> {
    const result = await prisma.billingInvoice.aggregate({
      where: { environment, pointOfSale },
      _max: { sequenceNumber: true },
    });
    return (result._max.sequenceNumber ?? 0) + 1;
  }

  async findIssuedBetween(
    from: Date,
    to: Date,
    environment: BillingFiscalEnvironment,
  ): Promise<BillingInvoiceWithItems[]> {
    return prisma.billingInvoice.findMany({
      where: {
        environment,
        issuedAt: {
          gte: from,
          lt: to,
        },
      },
      orderBy: [{ issuedAt: "asc" }, { invoiceNumber: "asc" }],
      include: invoiceListInclude,
    });
  }

  async markActivity(
    id: string,
    data: {
      printedAt?: Date;
      downloadedAt?: Date;
      sharedAt?: Date;
    },
  ): Promise<void> {
    await prisma.billingInvoice.update({
      where: { id },
      data,
    });
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}

export const billingInvoiceRepository = new BillingInvoiceRepository();
