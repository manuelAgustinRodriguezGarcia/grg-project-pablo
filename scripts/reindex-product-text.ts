#!/usr/bin/env tsx
import "dotenv/config";
import { prisma } from "@/server/database/prisma";
import { columnRepository } from "@/server/repositories/column.repository";
import { productRepository } from "@/server/repositories/product.repository";
import { buildIndexedTextForStoredProduct } from "@/server/services/product-field.builder";
import { equivalenceService } from "@/server/services/equivalence.service";

async function reindexFolder(folderId: string): Promise<number> {
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
    await productRepository.updateIndexedText(
      product.id,
      buildIndexedTextForStoredProduct(columns, product),
    );
    updated += 1;
  }

  return updated;
}

async function main(): Promise<void> {
  const folderIds = process.argv.slice(2);
  const folders =
    folderIds.length > 0
      ? await prisma.catalogFolder.findMany({
          where: { id: { in: folderIds } },
          select: { id: true, name: true },
          orderBy: [{ order: "asc" }, { name: "asc" }],
        })
      : await prisma.catalogFolder.findMany({
          select: { id: true, name: true },
          orderBy: [{ order: "asc" }, { name: "asc" }],
        });

  let total = 0;
  for (const folder of folders) {
    const updated = await reindexFolder(folder.id);
    total += updated;
    console.log(`Reindexados ${updated} productos en "${folder.name}" (${folder.id}).`);
  }

  console.log(`Reindexación finalizada. Productos actualizados: ${total}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
