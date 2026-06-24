import type { ProductImageSource } from "@/generated/prisma/client";
import { normalizeCodeForMatch } from "@/server/importers/match-detector";
import { getFileExtension } from "@/server/storage/sanitize-filename";

export type ProductForMatching = {
  id: string;
  primaryCode: string | null;
  normalizedCode: string | null;
  dynamicData: Record<string, unknown>;
};

export type ProductMatchIndex = {
  byCode: Map<string, string[]>;
};

export type ExternalImageInput = {
  originalName: string;
  buffer: Buffer;
  mimeType?: string;
  source: ProductImageSource;
};

export type ImageMatchCandidate = {
  productId: string;
  code: string;
};

export type ImageMatchOutcome =
  | { status: "ASSOCIATED_AUTO"; productId: string }
  | { status: "AMBIGUOUS"; candidates: ImageMatchCandidate[] }
  | { status: "PENDING_REVIEW" }
  | { status: "DUPLICATE_NAME" };

export type BuildProductMatchIndexOptions = {
  includePrimaryCode?: boolean;
};

export function buildProductMatchIndex(
  products: ProductForMatching[],
  imageCodeColumnKeys: string[],
  options: BuildProductMatchIndexOptions = {},
): ProductMatchIndex {
  const includePrimaryCode = options.includePrimaryCode ?? true;
  const byCode = new Map<string, string[]>();

  const addCode = (code: string | null | undefined, productId: string): void => {
    if (!code?.trim()) {
      return;
    }

    const normalized = normalizeCodeForMatch(code);
    const existing = byCode.get(normalized) ?? [];

    if (!existing.includes(productId)) {
      existing.push(productId);
    }

    byCode.set(normalized, existing);
  };

  for (const product of products) {
    if (includePrimaryCode) {
      addCode(product.primaryCode, product.id);
      addCode(product.normalizedCode, product.id);
    }

    for (const columnKey of imageCodeColumnKeys) {
      const value = product.dynamicData[columnKey];
      if (typeof value === "string") {
        addCode(value, product.id);
      }
    }
  }

  return { byCode };
}

export function normalizeFilenameForMatch(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  return normalizeCodeForMatch(base);
}

export function matchExternalImage(
  image: Pick<ExternalImageInput, "originalName">,
  index: ProductMatchIndex,
  seenNames: Map<string, number>,
): ImageMatchOutcome {
  const lowerName = image.originalName.toLowerCase();
  const occurrence = (seenNames.get(lowerName) ?? 0) + 1;
  seenNames.set(lowerName, occurrence);

  if (occurrence > 1) {
    return { status: "DUPLICATE_NAME" };
  }

  const normalizedName = normalizeFilenameForMatch(image.originalName);
  const productIds = index.byCode.get(normalizedName) ?? [];

  if (productIds.length === 1) {
    return { status: "ASSOCIATED_AUTO", productId: productIds[0]! };
  }

  if (productIds.length > 1) {
    return {
      status: "AMBIGUOUS",
      candidates: productIds.map((productId) => ({
        productId,
        code: normalizedName,
      })),
    };
  }

  return { status: "PENDING_REVIEW" };
}

export function isAllowedImageExtension(filename: string): boolean {
  const extension = getFileExtension(filename);
  return [".jpg", ".jpeg", ".png", ".webp"].includes(extension);
}

export class ImageMatchingService {
  buildIndex(
    products: ProductForMatching[],
    imageCodeColumnKeys: string[],
    options?: BuildProductMatchIndexOptions,
  ): ProductMatchIndex {
    return buildProductMatchIndex(products, imageCodeColumnKeys, options);
  }

  matchExternalImage(
    image: Pick<ExternalImageInput, "originalName">,
    index: ProductMatchIndex,
    seenNames: Map<string, number>,
  ): ImageMatchOutcome {
    return matchExternalImage(image, index, seenNames);
  }
}

export const imageMatchingService = new ImageMatchingService();
