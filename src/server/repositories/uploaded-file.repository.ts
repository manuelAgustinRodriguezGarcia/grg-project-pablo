import type { UploadedFile, UploadedFileStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export type CreateUploadedFileData = {
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  status?: UploadedFileStatus;
};

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

  async updateStatus(id: string, status: UploadedFileStatus): Promise<UploadedFile> {
    return prisma.uploadedFile.update({
      where: { id },
      data: { status },
    });
  }
}

export const uploadedFileRepository = new UploadedFileRepository();
