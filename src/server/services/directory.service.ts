import type { Catalog } from "@/generated/prisma/client";
import type {
  DirectoryCatalogItem,
  DirectoryResponse,
} from "@/features/directory/types/directory.types";
import { requireAuth } from "@/server/auth";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { createSignedDownloadUrl } from "@/server/storage";
import { STORAGE_BUCKETS } from "@/server/storage/types";
import { visibilityService } from "./visibility.service";
import { offlineSyncService } from "./offline-sync.service";

async function resolveCoverImageUrl(
  coverImagePath: string | null,
): Promise<string | null> {
  if (!coverImagePath) {
    return null;
  }

  try {
    const signed = await createSignedDownloadUrl(
      STORAGE_BUCKETS.PRODUCT_IMAGES,
      coverImagePath,
    );
    return signed.signedUrl;
  } catch {
    return null;
  }
}

function toDirectoryCatalogItem(
  catalog: Catalog,
  coverImageUrl: string | null,
  sectionCount: number,
  lastServerVersion: number,
): DirectoryCatalogItem {
  return {
    id: catalog.id,
    name: catalog.name,
    description: catalog.description,
    coverImageUrl,
    sectionCount,
    updatedAt: catalog.updatedAt.toISOString(),
    order: catalog.order,
    offlineSync: {
      status: lastServerVersion > 0 ? "ready" : "unavailable",
      lastServerVersion: lastServerVersion > 0 ? lastServerVersion : undefined,
    },
  };
}

export class DirectoryService {
  async getDirectory(): Promise<DirectoryResponse> {
    const { profile } = await requireAuth();
    const role = profile.role;
    const lastServerVersion = await offlineSyncService.getLastServerVersion(profile.id);

    const catalogs = await catalogRepository.findActiveOrdered();
    const visibleCatalogs = visibilityService.filterCatalogs(catalogs, role);

    const items = await Promise.all(
      visibleCatalogs.map(async (catalog) => {
        const coverImageUrl = await resolveCoverImageUrl(catalog.coverImagePath);
        const sectionCount = await folderRepository.countByCatalogId(
          catalog.id,
          visibilityService.folderWhereForRole(role),
        );

        return toDirectoryCatalogItem(catalog, coverImageUrl, sectionCount, lastServerVersion);
      }),
    );

    return {
      catalogs: items,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const directoryService = new DirectoryService();
