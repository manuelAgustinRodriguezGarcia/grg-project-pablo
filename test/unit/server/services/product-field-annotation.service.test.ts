import { beforeEach, describe, expect, it, vi } from "vitest";
import { columnRepository } from "@/server/repositories/column.repository";
import { productFieldAnnotationRepository } from "@/server/repositories/product-field-annotation.repository";
import { productRepository } from "@/server/repositories/product.repository";
import { productFieldAnnotationService } from "@/server/services/product-field-annotation.service";
import { ProductFieldAnnotationError } from "@/server/services/product-field-annotation.errors";
import {
  adminUserFixture,
  mockRequireRole,
} from "../../../helpers/mocks/auth";
import { createColumnFixture } from "../../../helpers/fixtures/column.fixture";
import { createFolderFixture } from "../../../helpers/fixtures/folder.fixture";
import {
  createProductFixture,
  PRODUCT_ID,
} from "../../../helpers/fixtures/product.fixture";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/server/repositories/product.repository", () => ({
  productRepository: { findById: vi.fn() },
}));
vi.mock("@/server/repositories/column.repository", () => ({
  columnRepository: { findByFolderIdOrdered: vi.fn() },
}));
vi.mock("@/server/repositories/product-field-annotation.repository", () => ({
  productFieldAnnotationRepository: {
    findByProductId: vi.fn(),
    findByProductIds: vi.fn(),
    findByProductAndKey: vi.fn(),
    upsert: vi.fn(),
    deleteByProductAndKey: vi.fn(),
    deleteByProductId: vi.fn(),
    deleteEmptyAnnotations: vi.fn(),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: { logOperationSafe: vi.fn() },
}));
vi.mock("@/server/storage", () => ({
  BUCKET_CONFIGS: {
    "product-field-help-images": { maxSizeBytes: 10 * 1024 * 1024 },
  },
  STORAGE_BUCKETS: { PRODUCT_FIELD_HELP_IMAGES: "product-field-help-images" },
  createSignedDownloadUrl: vi.fn(async () => ({ signedUrl: "https://signed.example/thumb.jpg" })),
  deleteFile: vi.fn(),
  uploadFile: vi.fn(),
}));
vi.mock("@/server/image-processors", () => ({
  buildProductFieldHelpImageStoragePaths: vi.fn(() => ({
    storagePath: "folder/product/key/img.jpg",
    thumbnailPath: "folder/product/key/img-thumb.webp",
  })),
  generateThumbnail: vi.fn(async () => ({ thumbnailBuffer: Buffer.from("thumb") })),
  validateImageBuffer: vi.fn(async () => ({ valid: true, mimeType: "image/jpeg" })),
}));

const annotationFixture = {
  id: "annotation-1",
  productId: PRODUCT_ID,
  columnInternalKey: "anclaje_frente",
  helpText: "Diagrama de montaje",
  helpImagePath: "folder/product/anclaje_frente/img.jpg",
  helpImageThumbnailPath: "folder/product/anclaje_frente/img-thumb.webp",
  helpImageMimeType: "image/jpeg",
  helpImageSizeBytes: 1024,
  helpImageOriginalName: "diagrama.jpg",
  helpImageAltText: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ProductFieldAnnotationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    vi.mocked(productRepository.findById).mockResolvedValue(createProductFixture());
    vi.mocked(columnRepository.findByFolderIdOrdered).mockResolvedValue([
      createColumnFixture({ internalKey: "anclaje_frente", displayName: "Anclaje frente" }),
    ]);
  });

  it("syncFieldAnnotations persiste texto de ayuda", async () => {
    vi.mocked(productFieldAnnotationRepository.findByProductAndKey).mockResolvedValue(null);
    vi.mocked(productFieldAnnotationRepository.upsert).mockResolvedValue(annotationFixture);

    await productFieldAnnotationService.syncFieldAnnotations(
      PRODUCT_ID,
      createFolderFixture().id,
      {
        anclaje_frente: { helpText: "Diagrama de montaje" },
      },
    );

    expect(productFieldAnnotationRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: PRODUCT_ID,
        columnInternalKey: "anclaje_frente",
        helpText: "Diagrama de montaje",
      }),
    );
  });

  it("rechaza columna desconocida al sincronizar", async () => {
    await expect(
      productFieldAnnotationService.syncFieldAnnotations(PRODUCT_ID, createFolderFixture().id, {
        columna_inexistente: { helpText: "Ayuda" },
      }),
    ).rejects.toBeInstanceOf(ProductFieldAnnotationError);
  });

  it("resolveForProducts agrupa anotaciones por producto y columna", async () => {
    vi.mocked(productFieldAnnotationRepository.findByProductIds).mockResolvedValue([
      annotationFixture,
    ]);

    const result = await productFieldAnnotationService.resolveForProducts([PRODUCT_ID]);

    expect(result.get(PRODUCT_ID)?.anclaje_frente).toEqual(
      expect.objectContaining({
        helpText: "Diagrama de montaje",
        thumbnailUrl: "https://signed.example/thumb.jpg",
      }),
    );
  });
});
