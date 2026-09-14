import type {
  BillingInvoiceType,
  BillingReceipt,
  BillingReceiptAllocation,
  BillingReceiptPaymentMethod,
  User,
} from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

const receiptListInclude = {
  client: { select: { id: true, name: true, email: true, whatsapp: true } },
  createdBy: { select: { id: true, name: true } },
  allocations: {
    orderBy: { createdAt: "asc" as const },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          invoiceType: true,
        },
      },
    },
  },
} satisfies Prisma.BillingReceiptInclude;

export type BillingReceiptWithRelations = BillingReceipt & {
  client: { id: string; name: string; email: string | null; whatsapp: string | null };
  createdBy: Pick<User, "id" | "name">;
  allocations: Array<
    BillingReceiptAllocation & {
      invoice: {
        id: string;
        invoiceNumber: string;
        invoiceType: BillingInvoiceType;
      };
    }
  >;
};

export type CreateBillingReceiptData = {
  receiptNumber: string;
  sequenceNumber: number;
  clientId: string;
  amount: Prisma.Decimal;
  paymentMethod: BillingReceiptPaymentMethod;
  notes: string | null;
  createdByUserId: string;
};

export class BillingReceiptRepository {
  async findById(id: string): Promise<BillingReceiptWithRelations | null> {
    return prisma.billingReceipt.findUnique({
      where: { id },
      include: receiptListInclude,
    });
  }

  async findAllOrdered(): Promise<BillingReceiptWithRelations[]> {
    return prisma.billingReceipt.findMany({
      orderBy: [{ issuedAt: "desc" }, { sequenceNumber: "desc" }],
      include: receiptListInclude,
    });
  }

  async getNextSequenceNumber(): Promise<number> {
    const result = await prisma.billingReceipt.aggregate({
      _max: { sequenceNumber: true },
    });
    return (result._max.sequenceNumber ?? 0) + 1;
  }

  async markActivity(
    id: string,
    data: {
      printedAt?: Date;
      downloadedAt?: Date;
      sharedAt?: Date;
    },
  ): Promise<void> {
    await prisma.billingReceipt.update({
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

export const billingReceiptRepository = new BillingReceiptRepository();

export type InvoiceAllocationSum = {
  invoiceId: string;
  allocated: Prisma.Decimal;
};

export async function sumAllocationsByInvoiceIds(
  invoiceIds: string[],
): Promise<Map<string, number>> {
  if (invoiceIds.length === 0) {
    return new Map();
  }

  const groups = await prisma.billingReceiptAllocation.groupBy({
    by: ["invoiceId"],
    where: { invoiceId: { in: invoiceIds } },
    _sum: { amount: true },
  });

  return new Map(
    groups.map((group) => [
      group.invoiceId,
      group._sum.amount?.toNumber() ?? 0,
    ]),
  );
}
