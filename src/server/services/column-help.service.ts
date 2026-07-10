import type { FolderColumn, UserRole } from "@/generated/prisma/client";
import { requireAuth, requireRole } from "@/server/auth";
import {
  buildColumnHelpImageStoragePaths,
  generateThumbnail,
  validateImageBuffer,
} from "@/server/image-processors";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { columnRepository } from "@/server/repositories/column.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import {
  BUCKET_CONFIGS,
  createSignedDownloadUrl,
  deleteFile,
  STORAGE_BUCKETS,
  uploadFile,
} from "@/server/storage";
import type { ColumnListItem } from "@/features/catalog/types/column.types";
import { toColumnDisplayItem } from "@/features/catalog/types/column.types";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "./audit.constants";
import { auditService } from "./audit.service";
import { ColumnHelpError } from "./column-help.errors";
import {
  hasContextualHelp,
  normalizeColumnHelpImageAltText,
  normalizeColumnHelpText,
  type ColumnHelpResolvedUrls,
} from "./column-help.utils";
import { VisibilityError } from "./visibility.errors";
import { visibilityService } from "./visibility.service";

const HELP_TEXT_MAX_LENGTH = 2000;
const HELP_IMAGE_ALT_MAX_LENGTH = 200;

function normalizeHelpText(value: string | null | undefined): string | null {
  const normalized = normalizeColumnHelpText(value);
  if (normalized && normalized.length > HELP_TEXT_MAX_LENGTH) {
    throw new ColumnHelpError(
      "El texto de ayuda no puede superar 2000 caracteres.",
      "VALIDATION_ERROR",
    );
  }

  return normalized;
}

function normalizeHelpImageAltText(value: string | null | undefined): string | null {
  const normalized = normalizeColumnHelpImageAltText(value);
  if (normalized && normalized.length > HELP_IMAGE_ALT_MAX_LENGTH) {
    throw new ColumnHelpError(
      "El texto alternativo no puede superar 200 caracteres.",
      "VALIDATION_ERROR",
    );
  }

  return normalized;
}

export type { ColumnHelpResolvedUrls };
export { hasContextualHelp };

async function requireColumn(id: string): Promise<FolderColumn> {
  const column = await columnRepository.findById(id);
  if (!column) {
    throw new ColumnHelpError("Columna no encontrada.", "COLUMN_NOT_FOUND");
  }

  return column;
}

async function assertColumnAccessibleForRole(
  column: FolderColumn,
  role: UserRole,
): Promise<void> {
  const folder = await folderRepository.findById(column.folderId);
  if (!folder) {
    throw new ColumnHelpError("Carpeta no encontrada.", "FOLDER_NOT_FOUND");
  }

  const catalog = await catalogRepository.findById(folder.catalogId);
  if (!catalog) {
    throw new ColumnHelpError("Catálogo no encontrado.", "CATALOG_NOT_FOUND");
  }

  try {
    visibilityService.assertCatalogVisibleForRole(catalog, role);
    visibilityService.assertFolderVisibleForRole(folder, role);
    visibilityService.assertColumnVisibleForRole(column, role);
  } catch (error) {
    if (error instanceof VisibilityError) {
      throw new ColumnHelpError("Columna no encontrada.", "COLUMN_NOT_FOUND");
    }

    throw error;
  }
}

async function deleteHelpImageFilesBestEffort(column: FolderColumn): Promise<void> {
  const paths = [column.helpImagePath, column.helpImageThumbnailPath].filter(
    (path): path is string => Boolean(path),
  );

  for (const path of paths) {
    try {
      await deleteFile(STORAGE_BUCKETS.COLUMN_HELP_IMAGES, path);
    } catch {
      // best effort
    }
  }
}

export class ColumnHelpService {
  hasContextualHelp(column: Pick<FolderColumn, "helpText" | "helpImagePath">): boolean {
    return hasContextualHelp(column);
  }

  async getColumnHelp(columnId: string): Promise<ColumnListItem> {
    const { profile } = await requireAuth();
    const column = await requireColumn(columnId);
    await assertColumnAccessibleForRole(column, profile.role);

    const [item] = await this.resolveHelpForColumns([column], profile.role);
    return item;
  }

  async resolveHelpForColumns(
    columns: FolderColumn[],
    role: UserRole,
  ): Promise<ColumnListItem[]> {
    const resolved = await Promise.all(
      columns.map(async (column) => {
        const urls = await this.resolveHelpImageUrls(column);
        return toColumnDisplayItem(column, urls);
      }),
    );

    if (role === "USUARIO") {
      return resolved.map((item) => ({
        ...item,
        helpText: item.visibleToNormalUser ? item.helpText : null,
        helpImageAltText: item.visibleToNormalUser ? item.helpImageAltText : null,
        hasContextualHelp: item.visibleToNormalUser ? item.hasContextualHelp : false,
        helpImagePreviewUrl: item.visibleToNormalUser ? item.helpImagePreviewUrl : null,
        helpImageFullUrl: item.visibleToNormalUser ? item.helpImageFullUrl : null,
      }));
    }

    return resolved;
  }

  async resolveHelpImageUrls(column: FolderColumn): Promise<ColumnHelpResolvedUrls> {
    if (!column.helpImagePath) {
      return {
        helpImagePreviewUrl: null,
        helpImageFullUrl: null,
      };
    }

    const [preview, full] = await Promise.all([
      column.helpImageThumbnailPath
        ? createSignedDownloadUrl(
            STORAGE_BUCKETS.COLUMN_HELP_IMAGES,
            column.helpImageThumbnailPath,
          ).then((result) => result.signedUrl)
        : Promise.resolve(null),
      createSignedDownloadUrl(STORAGE_BUCKETS.COLUMN_HELP_IMAGES, column.helpImagePath).then(
        (result) => result.signedUrl,
      ),
    ]);

    return {
      helpImagePreviewUrl: preview ?? full,
      helpImageFullUrl: full,
    };
  }

  async uploadHelpImage(input: {
    columnId: string;
    buffer: Buffer;
    originalFilename: string;
    altText?: string | null;
  }): Promise<ColumnListItem> {
    const { profile: admin } = await requireRole("ADMIN");
    const column = await requireColumn(input.columnId);

    const maxSize = BUCKET_CONFIGS[STORAGE_BUCKETS.COLUMN_HELP_IMAGES].maxSizeBytes;
    if (input.buffer.byteLength > maxSize) {
      throw new ColumnHelpError(
        "La imagen supera el tamaño máximo permitido.",
        "VALIDATION_ERROR",
      );
    }

    const validation = await validateImageBuffer(input.buffer);
    if (!validation.valid) {
      throw new ColumnHelpError(
        validation.error,
        "VALIDATION_ERROR",
      );
    }

    if (input.altText !== undefined) {
      const alt = normalizeHelpImageAltText(input.altText);
      if (alt && alt.length > HELP_IMAGE_ALT_MAX_LENGTH) {
        throw new ColumnHelpError(
          "El texto alternativo no puede superar 200 caracteres.",
          "VALIDATION_ERROR",
        );
      }
    }

    await deleteHelpImageFilesBestEffort(column);

    const imageId = crypto.randomUUID();
    const paths = buildColumnHelpImageStoragePaths(
      column.folderId,
      column.id,
      imageId,
      input.originalFilename,
    );
    const { thumbnailBuffer } = await generateThumbnail(input.buffer);

    await uploadFile({
      bucket: STORAGE_BUCKETS.COLUMN_HELP_IMAGES,
      path: paths.storagePath,
      body: input.buffer,
      contentType: validation.mimeType,
      originalFilename: input.originalFilename,
    });
    await uploadFile({
      bucket: STORAGE_BUCKETS.COLUMN_HELP_IMAGES,
      path: paths.thumbnailPath,
      body: thumbnailBuffer,
      contentType: "image/webp",
      originalFilename: `${imageId}-thumb.webp`,
    });

    const altText =
      input.altText !== undefined
        ? normalizeHelpImageAltText(input.altText)
        : column.helpImageAltText;

    const updated = await columnRepository.update(column.id, {
      helpImagePath: paths.storagePath,
      helpImageThumbnailPath: paths.thumbnailPath,
      helpImageMimeType: validation.mimeType,
      helpImageSizeBytes: input.buffer.byteLength,
      helpImageOriginalName: input.originalFilename,
      helpImageAltText: altText,
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.COLUMN_HELP_IMAGE_UPLOADED,
      entityType: AUDIT_ENTITY_TYPES.COLUMN,
      entityId: column.id,
    });

    const [item] = await this.resolveHelpForColumns([updated], "ADMIN");
    return item;
  }

  async deleteHelpImage(columnId: string): Promise<ColumnListItem> {
    const { profile: admin } = await requireRole("ADMIN");
    const column = await requireColumn(columnId);

    if (!column.helpImagePath) {
      throw new ColumnHelpError(
        "La columna no tiene imagen de ayuda.",
        "HELP_IMAGE_NOT_FOUND",
      );
    }

    await deleteHelpImageFilesBestEffort(column);

    const updated = await columnRepository.update(column.id, {
      helpImagePath: null,
      helpImageThumbnailPath: null,
      helpImageMimeType: null,
      helpImageSizeBytes: null,
      helpImageOriginalName: null,
    });

    auditService.logOperationSafe({
      userId: admin.id,
      action: AUDIT_ACTIONS.COLUMN_HELP_IMAGE_DELETED,
      entityType: AUDIT_ENTITY_TYPES.COLUMN,
      entityId: column.id,
    });

    const [item] = await this.resolveHelpForColumns([updated], "ADMIN");
    return item;
  }

  async deleteHelpImageBestEffort(column: FolderColumn): Promise<void> {
    if (!column.helpImagePath && !column.helpImageThumbnailPath) {
      return;
    }

    await deleteHelpImageFilesBestEffort(column);
  }

  normalizeHelpText(value: string | null | undefined): string | null {
    return normalizeHelpText(value);
  }

  normalizeHelpImageAltText(value: string | null | undefined): string | null {
    return normalizeHelpImageAltText(value);
  }
}

export const columnHelpService = new ColumnHelpService();
