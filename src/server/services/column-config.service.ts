import type { ColumnDataType, FolderColumn, UserRole } from "@/generated/prisma/client";
import { requireAuth, requireRole } from "@/server/auth";
import {
  columnRepository,
  type CreateColumnData,
  type ReorderColumnItem,
  type UpdateColumnData,
} from "@/server/repositories/column.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { ColumnConfigError } from "./column-config.errors";
import { ColumnHelpError } from "./column-help.errors";
import { columnHelpService } from "./column-help.service";
import { globalFieldService } from "./global-field.service";
import { visibilityService } from "./visibility.service";

const VALID_COLUMN_DATA_TYPES: ColumnDataType[] = [
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "IMAGE",
  "FORMULA",
  "UNKNOWN",
];

export type CreateColumnInput = CreateColumnData;

export type UpdateColumnInput = {
  id: string;
} & UpdateColumnData;

export type ReorderColumnsInput = {
  folderId: string;
  items: ReorderColumnItem[];
};

function assertColumnDataType(dataType: ColumnDataType): void {
  if (!VALID_COLUMN_DATA_TYPES.includes(dataType)) {
    throw new ColumnConfigError("Tipo de columna inválido.", "VALIDATION_ERROR");
  }
}

function normalizeInternalKey(key: string): string {
  return key.trim();
}

async function requireFolderExists(folderId: string): Promise<void> {
  const folder = await folderRepository.findById(folderId);
  if (!folder) {
    throw new ColumnConfigError("Carpeta no encontrada.", "FOLDER_NOT_FOUND");
  }
}

async function requireColumn(id: string): Promise<FolderColumn> {
  const column = await columnRepository.findById(id);
  if (!column) {
    throw new ColumnConfigError("Columna no encontrada.", "COLUMN_NOT_FOUND");
  }
  return column;
}

async function assertUniquePrimaryCode(
  folderId: string,
  isPrimaryCode: boolean,
  excludeId?: string,
): Promise<void> {
  if (!isPrimaryCode) {
    return;
  }

  const count = await columnRepository.countPrimaryCodeByFolder(folderId, excludeId);
  if (count > 0) {
    throw new ColumnConfigError(
      "Ya existe una columna de código principal en la carpeta.",
      "COLUMN_PRIMARY_CODE_CONFLICT",
    );
  }
}

async function handleColumnWrite<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (columnRepository.isUniqueConstraintError(error)) {
      throw new ColumnConfigError(
        "Ya existe una columna con esa clave interna en la carpeta.",
        "COLUMN_DUPLICATE_KEY",
      );
    }
    throw error;
  }
}

export class ColumnConfigService {
  async listColumns(folderId: string, role?: UserRole): Promise<FolderColumn[]> {
    if (role === undefined) {
      await requireRole("ADMIN");
      return columnRepository.findByFolderIdOrdered(folderId);
    }

    await requireAuth();
    await requireFolderExists(folderId);

    return columnRepository.findByFolderIdOrdered(
      folderId,
      visibilityService.columnWhereForRole(role),
    );
  }

  async listColumnsForUser(folderId: string): Promise<FolderColumn[]> {
    const { profile } = await requireAuth();
    return this.listColumns(folderId, profile.role);
  }

  async createColumn(input: CreateColumnInput): Promise<FolderColumn> {
    const { profile: admin } = await requireRole("ADMIN");

    await requireFolderExists(input.folderId);

    const originalName = input.originalName.trim();
    const displayName = input.displayName.trim();
    const internalKey = normalizeInternalKey(input.internalKey);

    if (!originalName || !displayName || !internalKey) {
      throw new ColumnConfigError(
        "Nombre original, visible y clave interna son obligatorios.",
        "VALIDATION_ERROR",
      );
    }

    if (input.dataType !== undefined) {
      assertColumnDataType(input.dataType);
    }

    await assertUniquePrimaryCode(input.folderId, input.isPrimaryCode ?? false);
    await globalFieldService.assertValidGlobalFieldKey(input.globalFieldKey);

    const order =
      input.order !== undefined
        ? input.order
        : await columnRepository.getNextOrder(input.folderId);

    const column = await handleColumnWrite(() =>
      columnRepository.create({
        ...input,
        originalName,
        displayName,
        internalKey,
        order,
      }),
    );

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.COLUMN_CREATED,
      entityType: AUDIT_ENTITY_TYPES.COLUMN,
      entityId: column.id,
    });

    return column;
  }

  async updateColumn(input: UpdateColumnInput): Promise<FolderColumn> {
    const { profile: admin } = await requireRole("ADMIN");

    const existing = await requireColumn(input.id);

    if (input.dataType !== undefined) {
      assertColumnDataType(input.dataType);
    }

    if (input.internalKey !== undefined) {
      const internalKey = normalizeInternalKey(input.internalKey);
      if (!internalKey) {
        throw new ColumnConfigError(
          "La clave interna no puede estar vacía.",
          "VALIDATION_ERROR",
        );
      }
    }

    if (input.isPrimaryCode === true) {
      await assertUniquePrimaryCode(existing.folderId, true, existing.id);
    }

    const nextGlobalFieldKey =
      input.globalFieldKey !== undefined ? input.globalFieldKey : existing.globalFieldKey;
    await globalFieldService.assertValidGlobalFieldKey(nextGlobalFieldKey);

    const hasChanges = Object.keys(input).some((key) => key !== "id");
    if (!hasChanges) {
      return existing;
    }

    const { id, ...rawData } = input;
    const data: UpdateColumnData = { ...rawData };

    try {
      if (data.helpText !== undefined) {
        data.helpText = columnHelpService.normalizeHelpText(data.helpText);
      }

      if (data.helpImageAltText !== undefined) {
        data.helpImageAltText = columnHelpService.normalizeHelpImageAltText(
          data.helpImageAltText,
        );
      }
    } catch (error) {
      if (error instanceof ColumnHelpError) {
        throw new ColumnConfigError(error.message, "VALIDATION_ERROR");
      }

      throw error;
    }

    const column = await handleColumnWrite(() => columnRepository.update(id, data));

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.COLUMN_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.COLUMN,
      entityId: column.id,
    });

    return column;
  }

  async reorderColumns(input: ReorderColumnsInput): Promise<FolderColumn[]> {
    const { profile: admin } = await requireRole("ADMIN");

    await requireFolderExists(input.folderId);

    if (input.items.length === 0) {
      throw new ColumnConfigError(
        "Debes indicar al menos una columna para reordenar.",
        "VALIDATION_ERROR",
      );
    }

    const ids = input.items.map((item) => item.id);
    const existing = await columnRepository.findManyByIds(ids);

    if (existing.length !== ids.length) {
      throw new ColumnConfigError("Columna no encontrada.", "COLUMN_NOT_FOUND");
    }

    const invalidFolder = existing.some(
      (column) => column.folderId !== input.folderId,
    );

    if (invalidFolder) {
      throw new ColumnConfigError(
        "Una o más columnas no pertenecen a la carpeta indicada.",
        "VALIDATION_ERROR",
      );
    }

    await columnRepository.reorder(input.items);

    for (const item of input.items) {
      auditService.logOperationSafe({
        userId: admin.id,
        action: AUDIT_ACTIONS.COLUMN_UPDATED,
        entityType: AUDIT_ENTITY_TYPES.COLUMN,
        entityId: item.id,
      });
    }

    return columnRepository.findByFolderIdOrdered(input.folderId);
  }

  async setColumnVisibility(id: string, visible: boolean): Promise<FolderColumn> {
    const { profile: admin } = await requireRole("ADMIN");

    const existing = await requireColumn(id);

    if (existing.visibleToNormalUser === visible) {
      return existing;
    }

    const column = await columnRepository.update(id, {
      visibleToNormalUser: visible,
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.COLUMN_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.COLUMN,
      entityId: column.id,
    });

    return column;
  }

  async deleteColumn(id: string): Promise<void> {
    const { profile: admin } = await requireRole("ADMIN");

    const existing = await requireColumn(id);
    await columnHelpService.deleteHelpImageBestEffort(existing);
    await columnRepository.delete(id);

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.COLUMN_DELETED,
      entityType: AUDIT_ENTITY_TYPES.COLUMN,
      entityId: id,
    });
  }
}

export const columnConfigService = new ColumnConfigService();
