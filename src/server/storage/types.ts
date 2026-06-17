export const STORAGE_BUCKETS = {
  EXCEL_ORIGINALS: "excel-originals",
  PRODUCT_IMAGES: "product-images",
  TEMP_IMPORTS: "temp-imports",
} as const;

export type StorageBucketName =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export interface BucketConfig {
  name: StorageBucketName;
  public: false;
  maxSizeBytes: number;
  allowedMimeTypes: readonly string[];
  allowedExtensions: readonly string[];
}

export interface UploadFileInput {
  bucket: StorageBucketName;
  /** Ruta relativa dentro del bucket (sin barra inicial). */
  path: string;
  body: Buffer | Uint8Array | ArrayBuffer;
  contentType: string;
  /** Nombre original para validar extensión y sanitizar si se construye la ruta. */
  originalFilename?: string;
  upsert?: boolean;
}

export interface UploadFileResult {
  bucket: StorageBucketName;
  path: string;
  sizeBytes: number;
  contentType: string;
}

export interface SignedUrlResult {
  bucket: StorageBucketName;
  path: string;
  signedUrl: string;
  expiresInSeconds: number;
}
