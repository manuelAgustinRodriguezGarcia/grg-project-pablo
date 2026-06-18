import type { Catalog } from "@/generated/prisma/client";
import type {
  DirectoryCatalogItem,
  DirectoryResponse,
} from "@/features/directory/types/directory.types";
import { requireAuth } from "@/server/auth";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { createSignedDownloadUrl } from "@/server/storage";
import { STORAGE_BUCKETS } from "@/server/storage/types";

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
): DirectoryCatalogItem {
  return {
    id: catalog.id,
    name: catalog.name,
    description: catalog.description,
    coverImageUrl,
    sectionCount: 0,
    updatedAt: catalog.updatedAt.toISOString(),
    order: catalog.order,
    offlineSync: {
      status: "unavailable",
    },
  };
}

export class DirectoryService {
  async getDirectory(): Promise<DirectoryResponse> {
    await requireAuth();

    const catalogs = await catalogRepository.findActiveOrdered();

    const items = await Promise.all(
      catalogs.map(async (catalog) => {
        const coverImageUrl = await resolveCoverImageUrl(catalog.coverImagePath);
        return toDirectoryCatalogItem(catalog, coverImageUrl);
      }),
    );

    return {
      catalogs: items,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const directoryService = new DirectoryService();
