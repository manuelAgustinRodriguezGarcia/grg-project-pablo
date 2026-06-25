import { createHash } from "node:crypto";
import { requireAuth } from "@/server/auth";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { columnRepository } from "@/server/repositories/column.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { offlineSyncManifestRepository } from "@/server/repositories/offline-sync-manifest.repository";
import { priceColumnRepository } from "@/server/repositories/price-column.repository";
import { priceItemRepository } from "@/server/repositories/price-item.repository";
import { priceListRepository } from "@/server/repositories/price-list.repository";
import { equivalentCodeRepository } from "@/server/repositories/equivalent-code.repository";
import { productImageRepository } from "@/server/repositories/product-image.repository";
import { prisma } from "@/server/database/prisma";
import { createSignedDownloadUrl } from "@/server/storage";
import { STORAGE_BUCKETS } from "@/server/storage/types";
import { navigationService } from "./navigation.service";
import { OfflineSyncError } from "./offline-sync.errors";
import { visibilityService } from "./visibility.service";
import type {
  OfflineFolderBundle,
  OfflinePriceListBundle,
  OfflineSyncManifestResponse,
  OfflineThumbnailsManifest,
} from "@/features/offline/types/offline-sync.types";
import { OFFLINE_PAYLOAD_VERSION } from "@/features/offline/types/offline-sync.types";

const DEFAULT_CHUNK_SIZE = 500;
const THUMBNAIL_URL_TTL_SECONDS = 3600;

function computePayloadHash(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export class OfflineSyncService {
  async getManifest(deviceId: string): Promise<OfflineSyncManifestResponse> {
    const { profile } = await requireAuth();
    const role = profile.role;

    const catalogs = visibilityService.filterCatalogs(
      await catalogRepository.findActiveOrdered(),
      role,
    );

    const catalogEntries = await Promise.all(
      catalogs.map(async (catalog) => {
        const folders = await folderRepository.findByCatalogIdOrdered(
          catalog.id,
          visibilityService.folderWhereForRole(role),
        );
        return {
          id: catalog.id,
          name: catalog.name,
          folderIds: folders.map((folder) => folder.id),
        };
      }),
    );

    const priceLists = visibilityService.filterPriceLists(
      await priceListRepository.findAllOrdered(
        visibilityService.priceListWhereForRole(role),
      ),
      role,
    );

    const folderIds = catalogEntries.flatMap((entry) => entry.folderIds);
    const priceListIds = priceLists.map((list) => list.id);

    const hashInput = JSON.stringify({
      catalogIds: catalogEntries.map((entry) => entry.id),
      folderIds,
      priceListIds,
      updatedAt: new Date().toISOString().slice(0, 16),
    });
    const checksum = computePayloadHash(hashInput);

    const previousVersion = await offlineSyncManifestRepository.getMaxVersionForUser(
      profile.id,
    );
    const manifestVersion = previousVersion + 1;
    const syncedAt = new Date();

    await offlineSyncManifestRepository.upsert({
      userId: profile.id,
      deviceId,
      version: manifestVersion,
      catalogIds: catalogEntries.map((entry) => entry.id),
      folderIds,
      priceListIds,
      payloadHash: checksum,
      syncedAt,
    });

    return {
      version: OFFLINE_PAYLOAD_VERSION,
      manifestVersion,
      syncedAt: syncedAt.toISOString(),
      checksum,
      catalogs: catalogEntries,
      priceLists: priceLists.map((list) => ({
        id: list.id,
        name: list.name,
      })),
    };
  }

  async getCatalogBundle(catalogId: string) {
    return navigationService.getCatalogNavigation(catalogId);
  }

  async getFolderBundle(
    folderId: string,
    cursor?: string,
    chunkSize = DEFAULT_CHUNK_SIZE,
  ): Promise<OfflineFolderBundle> {
    const { profile } = await requireAuth();
    const role = profile.role;

    const folder = await folderRepository.findById(folderId);
    if (!folder) {
      throw new OfflineSyncError("Carpeta no encontrada.", "FOLDER_NOT_FOUND");
    }

    try {
      visibilityService.assertFolderVisibleForRole(folder, role);
    } catch {
      throw new OfflineSyncError("Carpeta no encontrada.", "FOLDER_NOT_FOUND");
    }

    const columns = visibilityService.filterColumns(
      await columnRepository.findByFolderIdOrdered(folderId),
      role,
    );

    let items = await prisma.product.findMany({
      where: { folderId },
      orderBy: [{ id: "asc" }],
      take: chunkSize + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    let hasMore = false;
    let nextCursor: string | null = null;

    if (items.length > chunkSize) {
      hasMore = true;
      nextCursor = items[chunkSize - 1]?.id ?? null;
      items = items.slice(0, chunkSize);
    }

    const productIds = items.map((product) => product.id);
    const allEquivalences = await Promise.all(
      productIds.map((productId) =>
        equivalentCodeRepository.findByProductId(productId),
      ),
    );

    const visibleColumnKeys = new Set(columns.map((column) => column.internalKey));

    return {
      version: OFFLINE_PAYLOAD_VERSION,
      folder: {
        id: folder.id,
        name: folder.name,
        catalogId: folder.catalogId,
      },
      columns: columns.map((column) => ({
        id: column.id,
        internalKey: column.internalKey,
        displayName: column.displayName,
        dataType: column.dataType,
        visibleToNormalUser: column.visibleToNormalUser,
      })),
      products: items.map((product, index) => {
        const dynamicData =
          typeof product.dynamicData === "object" &&
          product.dynamicData !== null &&
          !Array.isArray(product.dynamicData)
            ? (product.dynamicData as Record<string, unknown>)
            : {};

        return {
          id: product.id,
          primaryCode: product.primaryCode,
          description: product.description,
          dynamicData: visibilityService.stripHiddenDynamicData(
            dynamicData,
            visibleColumnKeys,
            role,
          ),
          indexedText: product.indexedText,
          equivalentCodes: (allEquivalences[index] ?? []).map((code) => ({
            originalCode: code.originalCode,
            normalizedCode: code.normalizedCode,
          })),
        };
      }),
      hasMore,
      nextCursor,
    };
  }

  async getEquivalencesBundle(catalogId: string) {
    const { profile } = await requireAuth();
    const role = profile.role;

    const catalog = await catalogRepository.findById(catalogId);
    if (!catalog) {
      throw new OfflineSyncError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
    }

    try {
      visibilityService.assertCatalogVisibleForRole(catalog, role);
    } catch {
      throw new OfflineSyncError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
    }

    const folders = await folderRepository.findByCatalogIdOrdered(
      catalogId,
      visibilityService.folderWhereForRole(role),
    );
    const folderIds = folders.map((folder) => folder.id);

    if (folderIds.length === 0) {
      return { version: OFFLINE_PAYLOAD_VERSION, equivalences: [] };
    }

    const rows = await prisma.equivalentCode.findMany({
      where: {
        product: {
          folderId: { in: folderIds },
        },
      },
      select: {
        productId: true,
        originalCode: true,
        normalizedCode: true,
      },
    });

    return {
      version: OFFLINE_PAYLOAD_VERSION,
      catalogId,
      equivalences: rows,
    };
  }

  async getThumbnailsManifest(): Promise<OfflineThumbnailsManifest> {
    const { profile } = await requireAuth();
    const role = profile.role;

    const catalogs = visibilityService.filterCatalogs(
      await catalogRepository.findActiveOrdered(),
      role,
    );

    const folderIds: string[] = [];
    for (const catalog of catalogs) {
      const folders = await folderRepository.findByCatalogIdOrdered(
        catalog.id,
        visibilityService.folderWhereForRole(role),
      );
      folderIds.push(...folders.map((folder) => folder.id));
    }

    if (folderIds.length === 0) {
      return { version: OFFLINE_PAYLOAD_VERSION, thumbnails: [] };
    }

    const products = await prisma.product.findMany({
      where: { folderId: { in: folderIds } },
      select: { id: true },
    });
    const productIds = products.map((product) => product.id);

    const images = await productImageRepository.findAssociatedByProductIds(productIds);
    const expiresAt = new Date(Date.now() + THUMBNAIL_URL_TTL_SECONDS * 1000);

    const thumbnails = await Promise.all(
      images
        .filter((image) => image.productId && image.thumbnailPath)
        .map(async (image) => {
          const signed = await createSignedDownloadUrl(
            STORAGE_BUCKETS.PRODUCT_IMAGES,
            image.thumbnailPath!,
            THUMBNAIL_URL_TTL_SECONDS,
          );

          return {
            productId: image.productId!,
            thumbnailPath: image.thumbnailPath!,
            signedUrl: signed.signedUrl,
            expiresAt: expiresAt.toISOString(),
          };
        }),
    );

    return {
      version: OFFLINE_PAYLOAD_VERSION,
      thumbnails,
    };
  }

  async getPriceListBundle(
    priceListId: string,
    cursor?: string,
    chunkSize = DEFAULT_CHUNK_SIZE,
  ): Promise<OfflinePriceListBundle> {
    const { profile } = await requireAuth();
    const role = profile.role;

    const list = await priceListRepository.findById(priceListId);
    if (!list) {
      throw new OfflineSyncError(
        "Lista de precios no encontrada.",
        "PRICE_LIST_NOT_FOUND",
      );
    }

    try {
      visibilityService.assertPriceListVisibleForRole(list, role);
    } catch {
      throw new OfflineSyncError(
        "Lista de precios no encontrada.",
        "PRICE_LIST_NOT_FOUND",
      );
    }

    const columns = visibilityService.filterPriceColumns(
      await priceColumnRepository.findByPriceListIdOrdered(priceListId),
      role,
    );

    let items = await priceItemRepository.findByPriceListIdCursor(
      priceListId,
      cursor,
      chunkSize + 1,
    );

    let hasMore = false;
    let nextCursor: string | null = null;

    if (items.length > chunkSize) {
      hasMore = true;
      nextCursor = items[chunkSize - 1]?.id ?? null;
      items = items.slice(0, chunkSize);
    }

    const visibleColumnKeys = new Set(columns.map((column) => column.internalKey));

    return {
      version: OFFLINE_PAYLOAD_VERSION,
      priceList: {
        id: list.id,
        name: list.name,
      },
      columns: columns.map((column) => ({
        id: column.id,
        internalKey: column.internalKey,
        displayName: column.displayName,
        dataType: column.dataType,
        visibleToNormalUser: column.visibleToNormalUser,
      })),
      items: items.map((item) => {
        const dynamicData =
          typeof item.dynamicData === "object" &&
          item.dynamicData !== null &&
          !Array.isArray(item.dynamicData)
            ? (item.dynamicData as Record<string, unknown>)
            : {};

        return {
          id: item.id,
          primaryCode: item.primaryCode,
          description: item.description,
          amount: item.amount?.toString() ?? null,
          dynamicData: visibilityService.stripHiddenDynamicData(
            dynamicData,
            visibleColumnKeys,
            role,
          ),
          indexedText: item.indexedText,
        };
      }),
      hasMore,
      nextCursor,
    };
  }

  async getLastServerVersion(userId: string): Promise<number> {
    return offlineSyncManifestRepository.getMaxVersionForUser(userId);
  }
}

export const offlineSyncService = new OfflineSyncService();
