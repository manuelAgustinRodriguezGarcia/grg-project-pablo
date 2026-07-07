import type { ImportActionType, PriceColumn } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import {
  buildExistingCodeIndex,
  detectSemanticFlags,
  findMatchingProductId,
  type ImportJobConfig,
  type ParsedSheet,
} from "@/server/importers";
import {
  mapSheetToPriceItems,
  type MappedPriceItemRow,
} from "@/server/importers/price-item-row.mapper";
import { importJobRepository } from "@/server/repositories/import-job.repository";
import { priceColumnRepository } from "@/server/repositories/price-column.repository";
import { priceItemRepository } from "@/server/repositories/price-item.repository";
import { priceListRepository } from "@/server/repositories/price-list.repository";
import { buildIndexedTextForMappedPriceItem } from "@/server/services/price-field.builder";
import { isoDateOnlyToDate } from "@/shared/utils/date-only";
import { prisma } from "@/server/database/prisma";
import { ImportError } from "./import.errors";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";

const BATCH_SIZE = 500;

export type SetPriceImportDestinationInput = {
  priceListId: string;
  sheetName: string;
  supplierName: string;
  supplierDate: string;
};

export type ApplyPriceImportInput = {
  actionType: ImportActionType;
  confirmed: boolean;
};

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function countFormulas(items: MappedPriceItemRow[]): {
  formulasDetected: number;
  formulasWithoutCachedValue: number;
} {
  let formulasDetected = 0;
  let formulasWithoutCachedValue = 0;

  for (const item of items) {
    for (const value of Object.values(item.dynamicData)) {
      if (typeof value === "object" && value !== null && "formula" in value) {
        formulasDetected += 1;
        if (!("cachedValue" in value) || value.cachedValue === undefined) {
          formulasWithoutCachedValue += 1;
        }
      }
    }
  }

  return { formulasDetected, formulasWithoutCachedValue };
}

async function syncPriceColumnsFromSheet(
  priceListId: string,
  sheet: ParsedSheet,
  config: ImportJobConfig,
): Promise<PriceColumn[]> {
  let columns = await priceColumnRepository.findByPriceListIdOrdered(priceListId);
  const activeHeaders = sheet.headers.filter(
    (header) => !/^columna \d+$/i.test(header.originalName.trim()),
  );

  if (columns.length === 0) {
    const columnsToCreate = activeHeaders.map((header, index) => {
      const flags = detectSemanticFlags(header.originalName);
      return {
        priceListId,
        originalName: header.originalName,
        displayName: header.originalName,
        internalKey: header.internalKey,
        dataType: flags.isPrice ? ("NUMBER" as const) : header.inferredDataType,
        order: index,
        isPrimaryCode: flags.isPrimaryCode,
        isDescription: flags.isDescription,
        isPrice: flags.isPrice,
        isSearchable: flags.isPrimaryCode || flags.isDescription || flags.isPrice,
        isFilterable: flags.isPrice,
      };
    });

    if (columnsToCreate.length > 0) {
      await priceColumnRepository.createMany(columnsToCreate);
      columns = await priceColumnRepository.findByPriceListIdOrdered(priceListId);
    }

    return columns;
  }

  const existingKeys = new Set(columns.map((column) => column.internalKey));
  const existingNames = new Set(
    columns.map((column) => column.originalName.trim().toLowerCase()),
  );
  const columnsToCreate = [];

  for (let index = 0; index < activeHeaders.length; index += 1) {
    const header = activeHeaders[index];
    if (existingKeys.has(header.internalKey)) {
      continue;
    }
    if (existingNames.has(header.originalName.trim().toLowerCase())) {
      continue;
    }

    const flags = detectSemanticFlags(header.originalName);
    columnsToCreate.push({
      priceListId,
      originalName: header.originalName,
      displayName: header.originalName,
      internalKey: header.internalKey,
      dataType: flags.isPrice ? ("NUMBER" as const) : header.inferredDataType,
      order: columns.length + index,
      isPrimaryCode: flags.isPrimaryCode,
      isDescription: flags.isDescription,
      isPrice: flags.isPrice,
      isSearchable: flags.isPrimaryCode || flags.isDescription || flags.isPrice,
      isFilterable: flags.isPrice,
    });
  }

  if (columnsToCreate.length > 0) {
    await priceColumnRepository.createMany(columnsToCreate);
    columns = await priceColumnRepository.findByPriceListIdOrdered(priceListId);
  }

  if (config.primaryCodeColumnKey || config.descriptionColumnKey) {
    for (const column of columns) {
      const nextPrimary = column.internalKey === config.primaryCodeColumnKey;
      const nextDescription = column.internalKey === config.descriptionColumnKey;
      const nextPrice = column.isPrice;

      if (
        column.isPrimaryCode !== nextPrimary ||
        column.isDescription !== nextDescription
      ) {
        await priceColumnRepository.update(column.id, {
          isPrimaryCode: nextPrimary,
          isDescription: nextDescription,
          isSearchable: nextPrimary || nextDescription || nextPrice || column.isSearchable,
        });
      }
    }
    columns = await priceColumnRepository.findByPriceListIdOrdered(priceListId);
  }

  return columns;
}

export class PriceImportService {
  async setDestination(jobId: string, input: SetPriceImportDestinationInput) {
    const list = await priceListRepository.findById(input.priceListId);
    if (!list) {
      throw new ImportError("Lista de precios destino inválida.", "VALIDATION_ERROR");
    }

    await importJobRepository.deletePreview(jobId);

    await priceListRepository.update(input.priceListId, {
      supplierName: input.supplierName.trim(),
      supplierDate: isoDateOnlyToDate(input.supplierDate),
    });

    return importJobRepository.update(jobId, {
      destinationType: "PRICE_LIST",
      priceListId: input.priceListId,
      catalogId: null,
      folderId: null,
      targetSheetName: input.sheetName,
      status: "PENDING_CONFIG",
      progress: {
        phase: "config",
        percent: 55,
        message: "Configure columnas y genere la vista previa.",
      },
    });
  }

  async buildPreview(
    jobId: string,
    sheet: ParsedSheet,
    priceListId: string,
    config: ImportJobConfig,
  ) {
    const columns = await syncPriceColumnsFromSheet(priceListId, sheet, config);
    const mappedItems = mapSheetToPriceItems(sheet, columns, config);
    const existingItems = await priceItemRepository.findCodesByPriceList(priceListId);
    const matchIndex = buildExistingCodeIndex(existingItems);

    const recognizedItems = mappedItems.map((item) => {
      const matchedItemId = findMatchingProductId(item.primaryCode, matchIndex);
      return {
        ...item,
        isMatch: Boolean(matchedItemId),
        ...(matchedItemId ? { matchedItemId } : {}),
      };
    });

    const matchedItems = recognizedItems.filter((item) => item.isMatch);
    const allWarnings = recognizedItems.flatMap((item) => item.warnings);
    const formulaStats = countFormulas(recognizedItems);
    const itemCount = await priceItemRepository.countByPriceList(priceListId);

    const summary = {
      totalItems: recognizedItems.length,
      matchedCount: matchedItems.length,
      imageCount: 0,
      columnCount: sheet.columnCount,
      priceListItemCount: itemCount,
      priceListIsEmpty: itemCount === 0,
      formulasDetected: formulaStats.formulasDetected,
      formulasWithoutCachedValue: formulaStats.formulasWithoutCachedValue,
    };

    await importJobRepository.upsertPreview({
      importJobId: jobId,
      recognizedProducts: toPrismaJsonValue(recognizedItems),
      matchedProducts: toPrismaJsonValue(matchedItems),
      errors: [],
      warnings: allWarnings,
      summary: toPrismaJsonValue(summary),
    });

    return importJobRepository.update(jobId, {
      status: "READY_TO_APPLY",
      progress: {
        phase: "ready",
        percent: 90,
        message: "Vista previa lista. Confirme la acción de importación.",
      },
    });
  }

  async apply(
    jobId: string,
    input: ApplyPriceImportInput,
    adminUserId: string,
    sheet: ParsedSheet,
    priceListId: string,
    config: ImportJobConfig,
    previewItems: MappedPriceItemRow[],
  ) {
    const list = await priceListRepository.findByIdWithItemCount(priceListId);
    if (!list) {
      throw new ImportError("Lista de precios destino no encontrada.", "VALIDATION_ERROR");
    }

    const itemCount = list.itemCount;

    if (input.actionType === "IMPORTAR_LISTA" && itemCount > 0) {
      throw new ImportError(
        "La lista no está vacía. Use combinar o reemplazar.",
        "FOLDER_NOT_EMPTY",
      );
    }

    if (
      (input.actionType === "COMBINAR_LISTA" ||
        input.actionType === "REEMPLAZAR_LISTA") &&
      !input.confirmed
    ) {
      throw new ImportError(
        "Debe confirmar la operación antes de aplicar.",
        "CONFIRMATION_REQUIRED",
      );
    }

    const columns = await syncPriceColumnsFromSheet(priceListId, sheet, config);
    const mappedItems = mapSheetToPriceItems(sheet, columns, config);

    let itemsToInsert = mappedItems;

    if (input.actionType === "COMBINAR_LISTA") {
      const existingItems = await priceItemRepository.findCodesByPriceList(priceListId);
      const matchIndex = buildExistingCodeIndex(existingItems);
      itemsToInsert = mappedItems.filter(
        (item) => !findMatchingProductId(item.primaryCode, matchIndex),
      );
    }

    const skippedCount = mappedItems.length - itemsToInsert.length;
    const matchedInPreview = previewItems.filter((item) => item.isMatch).length;

    await prisma.$transaction(async () => {
      if (input.actionType === "REEMPLAZAR_LISTA") {
        await priceItemRepository.deleteByPriceList(priceListId);
      }

      for (let offset = 0; offset < itemsToInsert.length; offset += BATCH_SIZE) {
        const batch = itemsToInsert.slice(offset, offset + BATCH_SIZE);
        await priceItemRepository.createMany(
          batch.map((item) => ({
            priceListId,
            primaryCode: item.primaryCode,
            normalizedCode: item.normalizedCode,
            description: item.description,
            amount:
              item.amount !== null && item.amount !== undefined
                ? new Prisma.Decimal(item.amount)
                : null,
            dynamicData: item.dynamicData,
            originalText: item.originalText,
            indexedText: buildIndexedTextForMappedPriceItem(columns, item),
          })),
        );
      }
    });

    const formulaStats = countFormulas(mappedItems);
    const report = {
      fileName: null as string | null,
      priceListName: list.name,
      sheetImported: sheet.sheetName,
      itemsProcessed: mappedItems.length,
      itemsCreated: itemsToInsert.length,
      itemsSkipped: input.actionType === "COMBINAR_LISTA" ? skippedCount : 0,
      itemsMatched:
        input.actionType === "COMBINAR_LISTA" ? skippedCount : matchedInPreview,
      itemsDeleted: input.actionType === "REEMPLAZAR_LISTA" ? itemCount : 0,
      formulasDetected: formulaStats.formulasDetected,
      formulasWithoutCachedValue: formulaStats.formulasWithoutCachedValue,
      columnsDetected: sheet.columnCount,
      errors: [] as string[],
      warnings: previewItems.flatMap((item) => item.warnings),
      actionApplied: input.actionType,
    };

    await importJobRepository.update(jobId, {
      status: "PUBLISHED",
      actionType: input.actionType,
      finishedAt: new Date(),
      resultados: toPrismaJsonValue(report),
      progress: {
        phase: "published",
        percent: 100,
        message: "Importación de precios publicada.",
      },
    });

    auditService.logOperationSafe({
      userId: adminUserId,
      action: AUDIT_ACTIONS.PRICE_IMPORT_PUBLISHED,
      entityType: AUDIT_ENTITY_TYPES.IMPORT,
      entityId: jobId,
    });
  }
}

export const priceImportService = new PriceImportService();
