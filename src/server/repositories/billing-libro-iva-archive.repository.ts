import type {
  BillingFiscalEnvironment,
  BillingLibroIvaArchive,
  BillingLibroIvaArchiveFormat,
  BillingLibroIvaBookKind,
  User,
} from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

const archiveInclude = {
  generatedBy: { select: { id: true, name: true } },
} satisfies Prisma.BillingLibroIvaArchiveInclude;

export type BillingLibroIvaArchiveRecord = BillingLibroIvaArchive & {
  generatedBy: Pick<User, "id" | "name">;
};

export type BillingLibroIvaArchiveIdentity = {
  environment: BillingFiscalEnvironment;
  bookKind: BillingLibroIvaBookKind;
  year: number;
  month: number;
  format: BillingLibroIvaArchiveFormat;
};

export type CreateBillingLibroIvaArchiveData = BillingLibroIvaArchiveIdentity & {
  storagePath: string;
  fileName: string;
  sizeBytes: number;
  fileSha256: string;
  fiscalDataSha256: string;
  generatedAt: Date;
  generatedByUserId: string;
};

export type ListBillingLibroIvaArchivesFilter = {
  environment: BillingFiscalEnvironment;
  year?: number;
  month?: number;
};

export class BillingLibroIvaArchiveRepository {
  async findByIdentity(
    identity: BillingLibroIvaArchiveIdentity,
  ): Promise<BillingLibroIvaArchiveRecord | null> {
    return prisma.billingLibroIvaArchive.findFirst({
      where: identity,
      include: archiveInclude,
    });
  }

  async findById(id: string): Promise<BillingLibroIvaArchiveRecord | null> {
    return prisma.billingLibroIvaArchive.findUnique({
      where: { id },
      include: archiveInclude,
    });
  }

  async findByIds(
    ids: readonly string[],
    environment: BillingFiscalEnvironment,
  ): Promise<BillingLibroIvaArchiveRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    return prisma.billingLibroIvaArchive.findMany({
      where: {
        id: { in: [...ids] },
        environment,
      },
      include: archiveInclude,
    });
  }

  async list(
    filter: ListBillingLibroIvaArchivesFilter,
  ): Promise<BillingLibroIvaArchiveRecord[]> {
    return prisma.billingLibroIvaArchive.findMany({
      where: {
        environment: filter.environment,
        ...(filter.year === undefined ? {} : { year: filter.year }),
        ...(filter.month === undefined ? {} : { month: filter.month }),
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { format: "asc" }],
      include: archiveInclude,
    });
  }

  async create(
    data: CreateBillingLibroIvaArchiveData,
  ): Promise<BillingLibroIvaArchiveRecord> {
    return prisma.billingLibroIvaArchive.create({
      data,
      include: archiveInclude,
    });
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}

export const billingLibroIvaArchiveRepository =
  new BillingLibroIvaArchiveRepository();
