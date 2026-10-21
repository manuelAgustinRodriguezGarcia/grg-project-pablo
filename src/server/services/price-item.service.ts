import type { PriceColumn, UserRole } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { requireAuth, requirePermission } from "@/server/auth";
import {
  priceItemRepository,
  type PaginatedPriceItems,
} from "@/server/repositories/price-item.repository";
import { priceColumnRepository } from "@/server/repositories/price-column.repository";
import { priceListService } from "./price-list.service";
import { PriceItemError } from "./price-item.errors";
import { visibilityService } from "./visibility.service";
import { normalizeIndexedText } from "@/server/search/search-normalizer";
import { priceListRepository } from "@/server/repositories/price-list.repository";
import {
  priceListSearchSourcesAreEmpty,
  resolvePriceListSearchSources,
  type PriceListSearchSources,
} from "@/server/search/price-list-search";
import {
  buildSearchQueryPlan,
  MIN_GLOBAL_QUERY_CHARS,
} from "@/server/search/search-query-plan";
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
  order: number;
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

export type PriceGlobalSearchGroup = {
  priceList: {
    id: string;
    name: string;
  };
  columns: PriceItemTableColumn[];
  items: PriceItemTableRow[];
  total: number;
};

export type PriceGlobalSearchResponse = {
  query: string;
  groups: PriceGlobalSearchGroup[];
};

const GLOBAL_SEARCH_ITEMS_PER_LIST = 8;

export type ListPriceItemsInput = {
  priceListId: string;
  page?: number;
  pageSize?: number;
  query?: string;
  itemId?: string;
  filters?: ColumnFilterInput[] | unknown;
};

async function listFilteredItems(
  priceListId: string,
  paginationOptions: { page: number; pageSize: number },
  query: string,
  parsedFilters: ColumnFilterInput[],
  columns: PriceColumn[],
  sources: PriceListSearchSources,
): Promise<PaginatedPriceItems> {
  const { prismaFilters, jsonTextFilters, amountContainsFilters } =
    priceColumnFilterService.partitionFilters(parsedFilters, columns);

  const andConditions: Prisma.PriceItemWhereInput[] = [{ priceListId }];

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

  const plan = query ? buildSearchQueryPlan(query) : null;
  if (plan) {
    const matchingIds = await priceItemRepository.findIdsMatchingScopedSearch(
      priceListId,
      plan,
      sources,
    );
    where = {
      AND: [where, { id: { in: matchingIds } }],
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
    order: column.order,
    isPrimaryCode: column.isPrimaryCode,
    isDescription: column.isDescription,
    isPrice: column.isPrice,
    hasContextualHelp: Boolean(column.helpText || column.helpImagePath),
  };
}

function toTableRow(
  item: Awaited<ReturnType<typeof priceItemRepository.findById>>,
  visibleColumnKeys: Set<string>,
  role: UserRole,
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
  normalizedIndexedText: string | null;
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
    normalizedIndexedText: normalizeIndexedText(indexedText),
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
    const trimmedQuery = input.query?.trim() ?? "";
    const query =
      trimmedQuery.length >= MIN_GLOBAL_QUERY_CHARS ? trimmedQuery : "";
    const parsedFilters = priceColumnFilterService.parseFilters(input.filters);
    const filterableKeys = getPriceFilterableColumnKeys(columns);
    priceColumnFilterService.validateFiltersForColumns(
      parsedFilters,
      columns,
      filterableKeys,
      { requireFilterableColumn: false },
    );

    const sources = resolvePriceListSearchSources(columns);
    const searchPlan = query ? buildSearchQueryPlan(query) : null;
    const result: PaginatedPriceItems = input.itemId
      ? await priceItemRepository.findByPriceListPaginated(
          input.priceListId,
          paginationOptions,
          { id: input.itemId },
        )
      : parsedFilters.length > 0
        ? await listFilteredItems(
            input.priceListId,
            paginationOptions,
            query,
            parsedFilters,
            columns,
            sources,
          )
        : searchPlan
          ? await priceItemRepository.findByPriceListPaginatedWithScopedSearch(
              input.priceListId,
              paginationOptions,
              searchPlan,
              sources,
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

  async searchAllLists(rawQuery: string): Promise<PriceGlobalSearchResponse> {
    const { profile } = await requireAuth();
    const query = rawQuery.trim();
    const plan =
      query.length >= MIN_GLOBAL_QUERY_CHARS ? buildSearchQueryPlan(query) : null;

    if (!plan) {
      return { query, groups: [] };
    }

    const lists = await priceListRepository.findAllOrdered(
      visibilityService.priceListWhereForRole(profile.role),
    );
    if (lists.length === 0) {
      return { query, groups: [] };
    }

    const columns = await priceColumnRepository.findByPriceListIdsOrdered(
      lists.map((list) => list.id),
      visibilityService.priceColumnWhereForRole(profile.role),
    );

    const columnsByListId = new Map<string, PriceColumn[]>();
    for (const column of columns) {
      const listColumns = columnsByListId.get(column.priceListId) ?? [];
      listColumns.push(column);
      columnsByListId.set(column.priceListId, listColumns);
    }

    const scopes = lists
      .map((list) => ({
        priceListId: list.id,
        sources: resolvePriceListSearchSources(columnsByListId.get(list.id) ?? []),
      }))
      .filter((scope) => !priceListSearchSourcesAreEmpty(scope.sources));

    const rows = await priceItemRepository.searchAcrossPriceLists(
      scopes,
      plan,
      GLOBAL_SEARCH_ITEMS_PER_LIST,
    );

    const rowsByListId = new Map<string, typeof rows>();
    for (const row of rows) {
      const listRows = rowsByListId.get(row.priceListId) ?? [];
      listRows.push(row);
      rowsByListId.set(row.priceListId, listRows);
    }

    const groups: PriceGlobalSearchGroup[] = [];
    for (const list of lists) {
      const listRows = rowsByListId.get(list.id);
      if (!listRows || listRows.length === 0) {
        continue;
      }

      const listColumns = columnsByListId.get(list.id) ?? [];
      const visibleKeys = new Set(listColumns.map((column) => column.internalKey));

      groups.push({
        priceList: { id: list.id, name: list.name },
        columns: listColumns.map(toTableColumn),
        items: listRows.map((row) => toTableRow(row, visibleKeys, profile.role)),
        total: listRows[0]!.searchTotal,
      });
    }

    return { query, groups };
  }

  async locateItemPage(
    priceListId: string,
    itemId: string,
    pageSize: number,
  ): Promise<{ page: number }> {
    await priceListService.getPriceList(priceListId);

    const item = await priceItemRepository.findById(itemId);
    if (!item || item.priceListId !== priceListId) {
      throw new PriceItemError("Ítem no encontrado.", "PRICE_ITEM_NOT_FOUND");
    }

    const before = await priceItemRepository.countItemsBefore(priceListId, item);
    return { page: Math.floor(before / pageSize) + 1 };
  }

  async createItem(
    priceListId: string,
    values: Record<string, unknown>,
  ): Promise<PriceItemTableRow> {
    const { profile: admin } = await requirePermission("prices.create");
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
    return toTableRow(item, visibleKeys, "ADMINISTRADOR");
  }

  async updateItem(
    itemId: string,
    values: Record<string, unknown>,
  ): Promise<PriceItemTableRow> {
    const { profile: admin } = await requirePermission("prices.update");
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
    return toTableRow(item, visibleKeys, "ADMINISTRADOR");
  }

  async deleteItem(id: string): Promise<void> {
    const { profile: admin } = await requirePermission("prices.delete");
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
