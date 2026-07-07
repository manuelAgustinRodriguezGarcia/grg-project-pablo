import type { Prisma, UploadedFile, UploadedFileStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";
import { retainedUploadedFileWhere } from "@/server/services/uploaded-file-retention";

export type CreateUploadedFileData = {
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  status?: UploadedFileStatus;
};

export type UploadedFilePaginationOptions = {
  page: number;
  pageSize: number;
  query?: string;
};

export type PaginatedUploadedFiles = {
  items: UploadedFileWithHistory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type UploadedFileJobSummary = {
  id: string;
  status: string;
  destinationType: string;
  actionType: string | null;
  catalogId: string | null;
  folderId: string | null;
  priceListId: string | null;
  targetSheetName: string | null;
  resultados: unknown;
  errorMessage: string | null;
  finishedAt: Date | null;
  createdAt: Date;
  catalog: { id: string; name: string } | null;
  folder: { id: string; name: string; catalogId: string } | null;
  priceList: { id: string; name: string } | null;
  sheets: { id: string; sheetName: string }[];
};

export type UploadedFileWithHistory = UploadedFile & {
  uploadedBy: { id: string; name: string; email: string };
  importJobs: UploadedFileJobSummary[];
};

const uploadedFileHistoryInclude = {
  uploadedBy: {
    select: { id: true, name: true, email: true },
  },
  importJobs: {
    orderBy: { createdAt: "desc" as const },
    include: {
      catalog: { select: { id: true, name: true } },
      folder: { select: { id: true, name: true, catalogId: true } },
      priceList: { select: { id: true, name: true } },
      sheets: { select: { id: true, sheetName: true } },
    },
  },
} satisfies Prisma.UploadedFileInclude;

export class UploadedFileRepository {
  async create(data: CreateUploadedFileData): Promise<UploadedFile> {
    return prisma.uploadedFile.create({
      data: {
        originalName: data.originalName,
        storagePath: data.storagePath,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        uploadedById: data.uploadedById,
        status: data.status ?? "STORED",
      },
    });
  }

  async findById(id: string): Promise<UploadedFile | null> {
    return prisma.uploadedFile.findUnique({ where: { id } });
  }

  async findByIdWithHistory(id: string): Promise<UploadedFileWithHistory | null> {
    return prisma.uploadedFile.findUnique({
      where: { id },
      include: uploadedFileHistoryInclude,
    });
  }

  async findManyPaginated(
    options: UploadedFilePaginationOptions,
  ): Promise<PaginatedUploadedFiles> {
    const page = Math.max(1, options.page);
    const pageSize = Math.min(Math.max(1, options.pageSize), 100);
    const skip = (page - 1) * pageSize;

    const searchFilter: Prisma.UploadedFileWhereInput | undefined = options.query
      ? {
          originalName: {
            contains: options.query,
            mode: "insensitive",
          },
        }
      : undefined;

    const where: Prisma.UploadedFileWhereInput = searchFilter
      ? { AND: [retainedUploadedFileWhere, searchFilter] }
      : retainedUploadedFileWhere;

    const [items, total] = await Promise.all([
      prisma.uploadedFile.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: uploadedFileHistoryInclude,
      }),
      prisma.uploadedFile.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async updateStatus(id: string, status: UploadedFileStatus): Promise<UploadedFile> {
    return prisma.uploadedFile.update({
      where: { id },
      data: { status },
    });
  }

  async deleteById(id: string): Promise<void> {
    await prisma.uploadedFile.delete({ where: { id } });
  }

  async findAllWithHistory(): Promise<UploadedFileWithHistory[]> {
    return prisma.uploadedFile.findMany({
      orderBy: { createdAt: "desc" },
      include: uploadedFileHistoryInclude,
    });
  }
}

export const uploadedFileRepository = new UploadedFileRepository();
