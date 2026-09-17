import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingNote,
  BillingNoteKind,
  User,
} from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

const noteListInclude = {
  createdBy: { select: { id: true, name: true } },
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      invoiceType: true,
    },
  },
} satisfies Prisma.BillingNoteInclude;

export type BillingNoteWithRelations = BillingNote & {
  createdBy: Pick<User, "id" | "name">;
  invoice: {
    id: string;
    invoiceNumber: string;
    invoiceType: BillingInvoiceType;
  };
};

export type CreateBillingNoteData = {
  kind: BillingNoteKind;
  environment: BillingFiscalEnvironment;
  invoiceType: BillingInvoiceType;
  pointOfSale: string;
  sequenceNumber: number;
  noteNumber: string;
  invoiceId: string;
  clientId: string | null;
  clientCode: string;
  clientName: string;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
  amount: Prisma.Decimal;
  ivaPercent: Prisma.Decimal;
  ivaAmount: Prisma.Decimal;
  netAmount: Prisma.Decimal;
  reason: string;
  createdByUserId: string;
};

export class BillingNoteRepository {
  async findById(id: string): Promise<BillingNoteWithRelations | null> {
    return prisma.billingNote.findUnique({
      where: { id },
      include: noteListInclude,
    });
  }

  async findAllOrdered(): Promise<BillingNoteWithRelations[]> {
    return prisma.billingNote.findMany({
      orderBy: [{ issuedAt: "desc" }, { sequenceNumber: "desc" }],
      include: noteListInclude,
    });
  }

  async findIssuedBetween(
    from: Date,
    to: Date,
  ): Promise<BillingNoteWithRelations[]> {
    return prisma.billingNote.findMany({
      where: {
        issuedAt: {
          gte: from,
          lt: to,
        },
      },
      orderBy: [{ issuedAt: "asc" }, { noteNumber: "asc" }],
      include: noteListInclude,
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
    await prisma.billingNote.update({
      where: { id },
      data,
    });
  }

  async getNextSequenceNumber(kind: BillingNoteKind): Promise<number> {
    const result = await prisma.billingNote.aggregate({
      where: { kind },
      _max: { sequenceNumber: true },
    });
    return (result._max.sequenceNumber ?? 0) + 1;
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}

export const billingNoteRepository = new BillingNoteRepository();
