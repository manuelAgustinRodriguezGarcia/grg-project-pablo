import type { PriceColumn } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { requireAuth, requireRole } from "@/server/auth";
import {
  priceItemRepository,
  type PaginatedPriceItems,
} from "@/server/repositories/price-item.repository";
import { priceColumnRepository } from "@/server/repositories/price-column.repository";
import { priceListService } from "./price-list.service";
import { PriceItemError } from "./price-item.errors";
import { visibilityService } from "./visibility.service";
import { normalizeSearchTerm, normalizeTextContains } from "@/server/search/search-normalizer";
import { buildIndexedTextForMappedPriceItem } from "./price-field.builder";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { priceColumnFilterService } from "@/server/filters/price-column-filter.service";
import type { ColumnFilterInput } from "@/server/filters/column-filter.types";
import { getPriceFilterableColumnKeys } from "@/features/prices/utils/price-table-columns";

export type PriceItemTableColumn = {
  id: string;
  internalKey: string;
  displayName: string;
  originalName: string;
  dataType: string;
  visibleToNormalUser: boolean;
  isPrimaryCode: boolean;
  isDescription: boolean;
  isPrice: boolean;
  hasContextualHelp: boolean;
};

export type PriceItemTableRow = {
  id: string;
  primaryCode: string | null;
  description: string | null;
  amount: string | null;
  dynamicData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type PriceItemTableResponse = {
  priceList: {
    id: string;
    name: string;
  };
  columns: PriceItemTableColumn[];
  items: PriceItemTableRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ListPriceItemsInput = {
  priceListId: string;
  page?: number;
  pageSize?: number;
  query?: string;
  filters?: ColumnFilterInput[] | unknown;
};

function buildPriceItemTextSearchWhere(query: string): Prisma.PriceItemWhereInput {
  const textTerm = normalizeTextContains(query);
  const normalizedQuery = normalizeSearchTerm(query);

  return {
    OR: [
      { indexedText: { contains: textTerm, mode: "insensitive" } },
      { primaryCode: { contains: textTerm, mode: "insensitive" } },
      { description: { contains: textTerm, mode: "insensitive" } },
      { normalizedCode: { contains: normalizedQuery, mode: "insensitive" } },
    ],
  };
}

async function listFilteredItems(
  priceListId: string,
  paginationOptions: { page: number; pageSize: number },
  query: string,
  parsedFilters: ColumnFilterInput[],
  columns: PriceColumn[],
): Promise<PaginatedPriceItems> {
  const { prismaFilters, jsonTextFilters, amountContainsFilters } =
    priceColumnFilterService.partitionFilters(parsedFilters, columns);

  const andConditions: Prisma.PriceItemWhereInput[] = [{ priceListId }];

  if (query) {
    andConditions.push(buildPriceItemTextSearchWhere(query));
  }

  if (prismaFilters.length > 0) {
    andConditions.push(priceColumnFilterService.buildFilterWhere(prismaFilters, columns));
  }

  let where: Prisma.PriceItemWhereInput =
    andConditions.length === 1 ? andConditions[0]! : { AND: andConditions };

  const rawFilterGroups = [
    { filters: jsonTextFilters, finder: priceItemRepository.findIdsMatchingJsonTextFilters.bind(priceItemRepository) },
    {
      filters: amountContainsFilters,
      finder: priceItemRepository.findIdsMatchingAmountContainsFilters.bind(priceItemRepository),
    },
  ] as const;

  for (const { filters, finder } of rawFilterGroups) {
    if (filters.length === 0) {
      continue;
    }

    const matchingIds = await finder(priceListId, filters);
    where = {
      AND: [
        where,
        matchingIds.length > 0 ? { id: { in: matchingIds } } : { id: { in: [] } },
      ],
    };
  }

  return priceItemRepository.findPaginated(where, paginationOptions);
}

function toTableColumn(column: PriceColumn): PriceItemTableColumn {
  return {
    id: column.id,
    internalKey: column.internalKey,
    displayName: column.displayName,
    originalName: column.originalName,
    dataType: column.dataType,
    visibleToNormalUser: column.visibleToNormalUser,
    isPrimaryCode: column.isPrimaryCode,
    isDescription: column.isDescription,
    isPrice: column.isPrice,
    hasContextualHelp: Boolean(column.helpText || column.helpImagePath),
  };
}

function toTableRow(
  item: Awaited<ReturnType<typeof priceItemRepository.findById>>,
  visibleColumnKeys: Set<string>,
  role: "ADMIN" | "CONSULTA",
): PriceItemTableRow {
  const dynamicData =
    typeof item?.dynamicData === "object" &&
    item.dynamicData !== null &&
    !Array.isArray(item.dynamicData)
      ? (item.dynamicData as Record<string, unknown>)
      : {};

  return {
    id: item!.id,
    primaryCode: item!.primaryCode,
    description: item!.description,
    amount: item!.amount?.toString() ?? null,
    dynamicData: visibilityService.stripHiddenDynamicData(
      dynamicData,
      visibleColumnKeys,
      role,
    ),
    createdAt: item!.createdAt.toISOString(),
    updatedAt: item!.updatedAt.toISOString(),
  };
}

function mapItemValues(
  columns: PriceColumn[],
  values: Record<string, unknown>,
): {
  primaryCode: string | null;
  normalizedCode: string | null;
  description: string | null;
  amount: Prisma.Decimal | null;
  dynamicData: Record<string, unknown>;
  indexedText: string | null;
} {
  const primaryColumn = columns.find((column) => column.isPrimaryCode);
  const descriptionColumn = columns.find((column) => column.isDescription);
  const priceColumn = columns.find((column) => column.isPrice);

  const primaryCode = primaryColumn
    ? String(values[primaryColumn.internalKey] ?? "").trim() || null
    : null;
  const description = descriptionColumn
    ? String(values[descriptionColumn.internalKey] ?? "").trim() || null
    : null;

  const dynamicData: Record<string, unknown> = {};
  for (const column of columns) {
    if (
      column.isPrimaryCode ||
      column.isDescription ||
      column.isPrice ||
      !column.isAdminEditable
    ) {
      continue;
    }
    if (values[column.internalKey] !== undefined) {
      dynamicData[column.internalKey] = values[column.internalKey];
    }
  }

  const amountRaw = priceColumn ? values[priceColumn.internalKey] : undefined;
  const amount =
    amountRaw !== undefined && amountRaw !== null && amountRaw !== ""
      ? new Prisma.Decimal(String(amountRaw).replace(",", "."))
      : null;

  const indexedText = buildIndexedTextForMappedPriceItem(columns, {
    primaryCode,
    description,
    dynamicData,
    amount: amount?.toString() ?? null,
  });

  return {
    primaryCode,
    normalizedCode: primaryCode
      ? primaryCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
      : null,
    description,
    amount,
    dynamicData,
    indexedText,
  };
}

export class PriceItemService {
  async listItems(input: ListPriceItemsInput): Promise<PriceItemTableResponse> {
    const { profile } = await requireAuth();
    const priceList = await priceListService.getPriceList(input.priceListId);

    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 50;

    const columns = await priceColumnRepository.findByPriceListIdOrdered(
      input.priceListId,
      visibilityService.priceColumnWhereForRole(profile.role),
    );

    const visibleColumnKeys = new Set(columns.map((column) => column.internalKey));

    const paginationOptions = { page, pageSize };
    const query = input.query?.trim() ?? "";
    const parsedFilters = priceColumnFilterService.parseFilters(input.filters);
    const filterableKeys = getPriceFilterableColumnKeys(columns);
    priceColumnFilterService.validateFiltersForColumns(
      parsedFilters,
      columns,
      filterableKeys,
      { requireFilterableColumn: false },
    );

    const result: PaginatedPriceItems =
      parsedFilters.length > 0
        ? await listFilteredItems(
            input.priceListId,
            paginationOptions,
            query,
            parsedFilters,
            columns,
          )
        : query
          ? await priceItemRepository.findByPriceListPaginatedWithTextSearch(
              input.priceListId,
              paginationOptions,
              normalizeTextContains(query),
              normalizeSearchTerm(query),
            )
          : await priceItemRepository.findByPriceListPaginated(
              input.priceListId,
              paginationOptions,
            );

    return {
      priceList: { id: priceList.id, name: priceList.name },
      columns: columns.map(toTableColumn),
      items: result.items.map((item) =>
        toTableRow(item, visibleColumnKeys, profile.role),
      ),
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async createItem(
    priceListId: string,
    values: Record<string, unknown>,
  ): Promise<PriceItemTableRow> {
    const { profile: admin } = await requireRole("ADMIN");
    await priceListService.requirePriceListForAdmin(priceListId);

    const columns = await priceColumnRepository.findByPriceListIdOrdered(priceListId);
    const mapped = mapItemValues(columns, values);

    const item = await priceItemRepository.create({
      priceListId,
      ...mapped,
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRICE_ITEM_CREATED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_ITEM,
      entityId: item.id,
    });

    const visibleKeys = new Set(columns.map((column) => column.internalKey));
    return toTableRow(item, visibleKeys, "ADMIN");
  }

  async updateItem(
    itemId: string,
    values: Record<string, unknown>,
  ): Promise<PriceItemTableRow> {
    const { profile: admin } = await requireRole("ADMIN");
    const existing = await priceItemRepository.findById(itemId);
    if (!existing) {
      throw new PriceItemError("Ítem no encontrado.", "PRICE_ITEM_NOT_FOUND");
    }

    await priceListService.requirePriceListForAdmin(existing.priceListId);

    const columns = await priceColumnRepository.findByPriceListIdOrdered(
      existing.priceListId,
    );
    const mapped = mapItemValues(columns, values);

    const item = await priceItemRepository.update(itemId, mapped);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRICE_ITEM_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_ITEM,
      entityId: item.id,
    });

    const visibleKeys = new Set(columns.map((column) => column.internalKey));
    return toTableRow(item, visibleKeys, "ADMIN");
  }

  async deleteItem(id: string): Promise<void> {
    const { profile: admin } = await requireRole("ADMIN");
    const item = await priceItemRepository.findById(id);
    if (!item) {
      throw new PriceItemError("Ítem no encontrado.", "PRICE_ITEM_NOT_FOUND");
    }

    await priceListService.requirePriceListForAdmin(item.priceListId);
    await priceItemRepository.delete(id);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.PRICE_ITEM_DELETED,
      entityType: AUDIT_ENTITY_TYPES.PRICE_ITEM,
      entityId: id,
    });
  }
}

export const priceItemService = new PriceItemService();
