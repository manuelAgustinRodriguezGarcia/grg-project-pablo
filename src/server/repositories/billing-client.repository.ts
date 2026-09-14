import type {
  BillingClient,
  BillingIdentificationType,
  BillingIvaCondition,
} from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";
import { GENERIC_BILLING_CLIENT_NAME } from "@/shared/utils/billing-invoice-rules";

export type CreateBillingClientData = {
  code: string;
  codeNumber: number;
  name: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  identificationType: BillingIdentificationType;
  identificationNumber?: string | null;
  ivaCondition: BillingIvaCondition;
  notes?: string | null;
};

export type UpdateBillingClientData = Partial<{
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  email: string | null;
  whatsapp: string | null;
  identificationType: BillingIdentificationType;
  identificationNumber: string | null;
  ivaCondition: BillingIvaCondition;
  notes: string | null;
}>;

export class BillingClientRepository {
  async findAllOrdered(): Promise<BillingClient[]> {
    return prisma.billingClient.findMany({
      orderBy: [{ name: "asc" }, { codeNumber: "asc" }],
    });
  }

  async findById(id: string): Promise<BillingClient | null> {
    return prisma.billingClient.findUnique({ where: { id } });
  }

  async findByCode(code: string): Promise<BillingClient | null> {
    return prisma.billingClient.findUnique({ where: { code } });
  }

  async findByIdentification(
    identificationType: BillingIdentificationType,
    identificationNumber: string,
  ): Promise<BillingClient | null> {
    return prisma.billingClient.findFirst({
      where: { identificationType, identificationNumber },
    });
  }

  async findCanonicalGeneric(): Promise<BillingClient | null> {
    return prisma.billingClient.findFirst({
      where: {
        name: GENERIC_BILLING_CLIENT_NAME,
        identificationType: "NINGUNO",
        email: null,
        whatsapp: null,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(data: CreateBillingClientData): Promise<BillingClient> {
    return prisma.billingClient.create({
      data: {
        code: data.code,
        codeNumber: data.codeNumber,
        name: data.name,
        address: data.address ?? null,
        city: data.city ?? null,
        province: data.province ?? null,
        email: data.email ?? null,
        whatsapp: data.whatsapp ?? null,
        identificationType: data.identificationType,
        identificationNumber: data.identificationNumber ?? null,
        ivaCondition: data.ivaCondition,
        notes: data.notes ?? null,
      },
    });
  }

  async update(id: string, data: UpdateBillingClientData): Promise<BillingClient> {
    return prisma.billingClient.update({ where: { id }, data });
  }

  async delete(id: string): Promise<BillingClient> {
    return prisma.billingClient.delete({ where: { id } });
  }

  async getNextCodeNumber(): Promise<number> {
    const result = await prisma.billingClient.aggregate({
      _max: { codeNumber: true },
    });
    return (result._max.codeNumber ?? 0) + 1;
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}

export const billingClientRepository = new BillingClientRepository();
