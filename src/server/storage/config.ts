import type { BucketConfig, StorageBucketName } from "./types";
import { STORAGE_BUCKETS } from "./types";

const MB = 1024 * 1024;

export const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 3600;

export const BUCKET_CONFIGS: Record<StorageBucketName, BucketConfig> = {
  [STORAGE_BUCKETS.EXCEL_ORIGINALS]: {
    name: STORAGE_BUCKETS.EXCEL_ORIGINALS,
    public: false,
    maxSizeBytes: 50 * MB,
    allowedMimeTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel.sheet.macroEnabled.12",
    ],
    allowedExtensions: [".xlsx", ".xlsm"],
  },
  [STORAGE_BUCKETS.PRODUCT_IMAGES]: {
    name: STORAGE_BUCKETS.PRODUCT_IMAGES,
    public: false,
    maxSizeBytes: 10 * MB,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
  },
  [STORAGE_BUCKETS.TEMP_IMPORTS]: {
    name: STORAGE_BUCKETS.TEMP_IMPORTS,
    public: false,
    maxSizeBytes: 50 * MB,
    allowedMimeTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel.sheet.macroEnabled.12",
      "application/zip",
      "application/x-zip-compressed",
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
    allowedExtensions: [
      ".xlsx",
      ".xlsm",
      ".zip",
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
    ],
  },
};

export const ALL_STORAGE_BUCKETS = Object.values(STORAGE_BUCKETS);
