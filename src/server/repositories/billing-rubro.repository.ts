import type {
  BillingRubro,
  BillingRubroStatus,
} from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export type CreateBillingRubroData = {
  code: string;
  codeNumber: number;
  name: string;
  description?: string | null;
  status: BillingRubroStatus;
};

export type UpdateBillingRubroData = Partial<{
  code: string;
  name: string;
  description: string | null;
  status: BillingRubroStatus;
}>;

export class BillingRubroRepository {
  async findAllOrdered(): Promise<BillingRubro[]> {
    return prisma.billingRubro.findMany({
      orderBy: [{ name: "asc" }, { codeNumber: "asc" }],
    });
  }

  async findById(id: string): Promise<BillingRubro | null> {
    return prisma.billingRubro.findUnique({ where: { id } });
  }

  async findByIds(ids: string[]): Promise<BillingRubro[]> {
    return prisma.billingRubro.findMany({ where: { id: { in: ids } } });
  }

  async findByName(name: string): Promise<BillingRubro | null> {
    return prisma.billingRubro.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
  }

  async findByCode(code: string): Promise<BillingRubro | null> {
    return prisma.billingRubro.findFirst({
      where: { code: { equals: code, mode: "insensitive" } },
    });
  }

  async create(data: CreateBillingRubroData): Promise<BillingRubro> {
    return prisma.billingRubro.create({
      data: {
        code: data.code,
        codeNumber: data.codeNumber,
        name: data.name,
        description: data.description ?? null,
        status: data.status,
      },
    });
  }

  async update(id: string, data: UpdateBillingRubroData): Promise<BillingRubro> {
    return prisma.billingRubro.update({ where: { id }, data });
  }

  async delete(id: string): Promise<BillingRubro> {
    return prisma.billingRubro.delete({ where: { id } });
  }

  async getNextCodeNumber(): Promise<number> {
    const result = await prisma.billingRubro.aggregate({
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

  isUniqueNameError(error: unknown): boolean {
    if (!this.isUniqueConstraintError(error)) {
      return false;
    }

    const target = (error as Prisma.PrismaClientKnownRequestError).meta?.target;
    return Array.isArray(target) && target.includes("name");
  }

  isUniqueCodeError(error: unknown): boolean {
    if (!this.isUniqueConstraintError(error)) {
      return false;
    }

    const target = (error as Prisma.PrismaClientKnownRequestError).meta?.target;
    return Array.isArray(target) && target.includes("code");
  }
}

export const billingRubroRepository = new BillingRubroRepository();
