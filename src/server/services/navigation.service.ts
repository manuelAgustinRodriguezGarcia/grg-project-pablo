import { requireAuth } from "@/server/auth";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { createSignedDownloadUrl } from "@/server/storage";
import { STORAGE_BUCKETS } from "@/server/storage/types";
import type { CatalogNavigationResponse } from "@/features/catalog/types/navigation.types";
import { CatalogError } from "./catalog.errors";
import { VisibilityError } from "./visibility.errors";
import { visibilityService } from "./visibility.service";

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

export class NavigationService {
  async getCatalogNavigation(catalogId: string): Promise<CatalogNavigationResponse> {
    const { profile } = await requireAuth();
    const role = profile.role;

    const catalog = await catalogRepository.findById(catalogId);
    if (!catalog) {
      throw new CatalogError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
    }

    if (catalog.status !== "ACTIVE") {
      throw new CatalogError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
    }

    try {
      visibilityService.assertCatalogVisibleForRole(catalog, role);
    } catch (error) {
      if (error instanceof VisibilityError) {
        throw new CatalogError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
      }
      throw error;
    }

    const folders = await folderRepository.findByCatalogIdOrdered(
      catalogId,
      visibilityService.folderWhereForRole(role),
    );

    const coverImageUrl = await resolveCoverImageUrl(catalog.coverImagePath);

    return {
      catalog: {
        id: catalog.id,
        name: catalog.name,
        description: catalog.description,
        coverImageUrl,
        order: catalog.order,
        visibleToNormalUser: catalog.visibleToNormalUser,
        updatedAt: catalog.updatedAt.toISOString(),
      },
      folders: folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        description: folder.description,
        order: folder.order,
        visibleToNormalUser: folder.visibleToNormalUser,
        productCount: folder.productCount,
        updatedAt: folder.updatedAt.toISOString(),
      })),
      generatedAt: new Date().toISOString(),
    };
  }
}

export const navigationService = new NavigationService();
