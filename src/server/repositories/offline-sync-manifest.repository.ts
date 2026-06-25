import type { OfflineSyncManifest } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export type UpsertOfflineSyncManifestData = {
  userId: string;
  deviceId: string;
  version: number;
  catalogIds: string[];
  folderIds: string[];
  priceListIds: string[];
  payloadHash: string;
  syncedAt?: Date;
};

export class OfflineSyncManifestRepository {
  async findByUserAndDevice(
    userId: string,
    deviceId: string,
  ): Promise<OfflineSyncManifest | null> {
    return prisma.offlineSyncManifest.findUnique({
      where: {
        userId_deviceId: { userId, deviceId },
      },
    });
  }

  async findLatestByUser(userId: string): Promise<OfflineSyncManifest | null> {
    return prisma.offlineSyncManifest.findFirst({
      where: { userId },
      orderBy: { version: "desc" },
    });
  }

  async upsert(data: UpsertOfflineSyncManifestData): Promise<OfflineSyncManifest> {
    return prisma.offlineSyncManifest.upsert({
      where: {
        userId_deviceId: {
          userId: data.userId,
          deviceId: data.deviceId,
        },
      },
      create: {
        userId: data.userId,
        deviceId: data.deviceId,
        version: data.version,
        catalogIds: data.catalogIds,
        folderIds: data.folderIds,
        priceListIds: data.priceListIds,
        payloadHash: data.payloadHash,
        syncedAt: data.syncedAt ?? new Date(),
      },
      update: {
        version: data.version,
        catalogIds: data.catalogIds,
        folderIds: data.folderIds,
        priceListIds: data.priceListIds,
        payloadHash: data.payloadHash,
        syncedAt: data.syncedAt ?? new Date(),
      },
    });
  }

  async getMaxVersionForUser(userId: string): Promise<number> {
    const result = await prisma.offlineSyncManifest.aggregate({
      where: { userId },
      _max: { version: true },
    });
    return result._max.version ?? 0;
  }
}

export const offlineSyncManifestRepository = new OfflineSyncManifestRepository();
