export const OFFLINE_PAYLOAD_VERSION = 1 as const;

export type OfflineSyncManifestResponse = {
  version: typeof OFFLINE_PAYLOAD_VERSION;
  manifestVersion: number;
  syncedAt: string;
  checksum: string;
  catalogs: Array<{
    id: string;
    name: string;
    folderIds: string[];
  }>;
  priceLists: Array<{
    id: string;
    name: string;
  }>;
};

export type OfflineFolderBundle = {
  version: typeof OFFLINE_PAYLOAD_VERSION;
  folder: {
    id: string;
    name: string;
    catalogId: string;
  };
  columns: Array<{
    id: string;
    internalKey: string;
    displayName: string;
    dataType: string;
    visibleToNormalUser: boolean;
  }>;
  products: Array<{
    id: string;
    primaryCode: string | null;
    description: string | null;
    dynamicData: Record<string, unknown>;
    indexedText: string | null;
    equivalentCodes: Array<{
      originalCode: string;
      normalizedCode: string;
    }>;
  }>;
  hasMore: boolean;
  nextCursor: string | null;
};

export type OfflineThumbnailEntry = {
  productId: string;
  thumbnailPath: string;
  signedUrl: string;
  expiresAt: string;
};

export type OfflineThumbnailsManifest = {
  version: typeof OFFLINE_PAYLOAD_VERSION;
  thumbnails: OfflineThumbnailEntry[];
};

export type OfflinePriceListBundle = {
  version: typeof OFFLINE_PAYLOAD_VERSION;
  priceList: {
    id: string;
    name: string;
  };
  columns: Array<{
    id: string;
    internalKey: string;
    displayName: string;
    dataType: string;
    visibleToNormalUser: boolean;
  }>;
  items: Array<{
    id: string;
    primaryCode: string | null;
    description: string | null;
    amount: string | null;
    dynamicData: Record<string, unknown>;
    indexedText: string | null;
  }>;
  hasMore: boolean;
  nextCursor: string | null;
};
