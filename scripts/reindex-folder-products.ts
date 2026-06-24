#!/usr/bin/env tsx
import { columnRepository } from "@/server/repositories/column.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { productRepository } from "@/server/repositories/product.repository";
import { buildIndexedTextForStoredProduct } from "@/server/services/product-field.builder";
import { equivalenceService } from "@/server/services/equivalence.service";

async function reindexFolder(folderId: string): Promise<number> {
  const folder = await folderRepository.findById(folderId);
  if (!folder) {
    throw new Error(`Carpeta no encontrada: ${folderId}`);
  }

  const columns = await columnRepository.findByFolderIdOrdered(folderId);
  const products = await productRepository.findByFolderIdForReindex(folderId);
  let updated = 0;

  for (const product of products) {
    const dynamicData =
      typeof product.dynamicData === "object" &&
      product.dynamicData !== null &&
      !Array.isArray(product.dynamicData)
        ? (product.dynamicData as Record<string, unknown>)
        : {};

    await equivalenceService.syncFromProduct(product.id, columns, dynamicData);

    const indexedText = buildIndexedTextForStoredProduct(columns, product);
    await productRepository.updateIndexedText(product.id, indexedText);
    updated += 1;
  }

  return updated;
}

async function main(): Promise<void> {
  const folderId = process.argv[2];

  if (!folderId) {
    console.error("Uso: pnpm tsx scripts/reindex-folder-products.ts <folderId>");
    process.exit(1);
  }

  const updated = await reindexFolder(folderId);
  console.log(`Reindexados ${updated} productos en carpeta ${folderId}.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
