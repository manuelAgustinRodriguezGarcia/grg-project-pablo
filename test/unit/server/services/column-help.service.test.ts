import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForbiddenError } from "@/server/auth/errors";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { columnRepository } from "@/server/repositories/column.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { columnHelpService } from "@/server/services/column-help.service";
import { hasContextualHelp } from "@/server/services/column-help.utils";
import {
  adminUserFixture,
  usuarioUserFixture,
  mockRequireAuth,
  mockRequireRole,
  mockRequireRoleForbidden,
} from "../../../helpers/mocks/auth";
import { createCatalogFixture } from "../../../helpers/fixtures/catalog.fixture";
import { createColumnFixture, COLUMN_ID } from "../../../helpers/fixtures/column.fixture";
import { createFolderFixture, FOLDER_ID } from "../../../helpers/fixtures/folder.fixture";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  requireAdmin: vi.fn(),
  requireEditor: vi.fn(),
}));
vi.mock("@/server/repositories/column.repository", () => ({
  columnRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("@/server/repositories/folder.repository", () => ({
  folderRepository: {
    findById: vi.fn(),
  },
}));
vi.mock("@/server/repositories/catalog.repository", () => ({
  catalogRepository: {
    findById: vi.fn(),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperationSafe: vi.fn(),
  },
}));
vi.mock("@/server/image-processors", () => ({
  validateImageBuffer: vi.fn(async () => ({ valid: true, mimeType: "image/jpeg" })),
  generateThumbnail: vi.fn(async () => ({ thumbnailBuffer: Buffer.from("thumb") })),
  buildColumnHelpImageStoragePaths: vi.fn(() => ({
    storagePath: `${FOLDER_ID}/${COLUMN_ID}/img.jpg`,
    thumbnailPath: `${FOLDER_ID}/${COLUMN_ID}/img-thumb.webp`,
  })),
}));
vi.mock("@/server/storage", () => ({
  BUCKET_CONFIGS: {
    "column-help-images": { maxSizeBytes: 10 * 1024 * 1024 },
  },
  STORAGE_BUCKETS: {
    COLUMN_HELP_IMAGES: "column-help-images",
  },
  createSignedDownloadUrl: vi.fn(async (_bucket: string, path: string) => ({
    signedUrl: `https://signed.example/${path}`,
    bucket: "column-help-images",
    path,
    expiresInSeconds: 3600,
  })),
  deleteFile: vi.fn(),
  uploadFile: vi.fn(),
}));

describe("column-help.utils", () => {
  it("detecta ayuda contextual por texto, imagen o ambos", () => {
    expect(hasContextualHelp(createColumnFixture())).toBe(false);
    expect(hasContextualHelp(createColumnFixture({ helpText: "Ayuda" }))).toBe(true);
    expect(
      hasContextualHelp(createColumnFixture({ helpImagePath: "folder/col/img.jpg" })),
    ).toBe(true);
    expect(
      hasContextualHelp(
        createColumnFixture({
          helpText: "  ",
          helpImagePath: null,
        }),
      ),
    ).toBe(false);
  });
});

describe("ColumnHelpService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    mockRequireAuth(adminUserFixture);
    vi.mocked(folderRepository.findById).mockResolvedValue(createFolderFixture());
    vi.mocked(catalogRepository.findById).mockResolvedValue(createCatalogFixture());
    vi.mocked(columnRepository.findById).mockImplementation(async (id) =>
      id === COLUMN_ID ? createColumnFixture() : null,
    );
    vi.mocked(columnRepository.update).mockImplementation(async (_id, data) =>
      createColumnFixture(data as never),
    );
  });

  it("resuelve columnas con URLs firmadas y hasContextualHelp", async () => {
    const column = createColumnFixture({
      helpText: "Medida entre tapa",
      helpImagePath: `${FOLDER_ID}/${COLUMN_ID}/img.jpg`,
      helpImageThumbnailPath: `${FOLDER_ID}/${COLUMN_ID}/img-thumb.webp`,
    });

    const [item] = await columnHelpService.resolveHelpForColumns([column], "ADMIN");

    expect(item.hasContextualHelp).toBe(true);
    expect(item.helpText).toBe("Medida entre tapa");
    expect(item.helpImagePreviewUrl).toContain("img-thumb.webp");
    expect(item.helpImageFullUrl).toContain("img.jpg");
  });

  it("sube imagen de ayuda y registra auditoría", async () => {
    const item = await columnHelpService.uploadHelpImage({
      columnId: COLUMN_ID,
      buffer: Buffer.from("image"),
      originalFilename: "ayuda.jpg",
      altText: "Referencia visual",
    });

    expect(item.helpImageFullUrl).toContain("img.jpg");
    expect(auditService.logOperationSafe).toHaveBeenCalledWith({
      userId: adminUserFixture.id,
      action: AUDIT_ACTIONS.COLUMN_HELP_IMAGE_UPLOADED,
      entityType: AUDIT_ENTITY_TYPES.COLUMN,
      entityId: COLUMN_ID,
    });
  });

  it("elimina imagen de ayuda", async () => {
    vi.mocked(columnRepository.findById).mockResolvedValue(
      createColumnFixture({
        helpImagePath: `${FOLDER_ID}/${COLUMN_ID}/img.jpg`,
        helpImageThumbnailPath: `${FOLDER_ID}/${COLUMN_ID}/img-thumb.webp`,
        helpImageAltText: "Referencia",
      }),
    );

    const item = await columnHelpService.deleteHelpImage(COLUMN_ID);

    expect(columnRepository.update).toHaveBeenCalledWith(
      COLUMN_ID,
      expect.objectContaining({
        helpImagePath: null,
        helpImageThumbnailPath: null,
        helpImageAltText: null,
      }),
    );
    expect(item.helpImageFullUrl).toBeNull();
    expect(auditService.logOperationSafe).toHaveBeenCalledWith({
      userId: adminUserFixture.id,
      action: AUDIT_ACTIONS.COLUMN_HELP_IMAGE_DELETED,
      entityType: AUDIT_ENTITY_TYPES.COLUMN,
      entityId: COLUMN_ID,
    });
  });

  it("rechaza subir imagen sin permisos ADMIN", async () => {
    mockRequireRoleForbidden();

    await expect(
      columnHelpService.uploadHelpImage({
        columnId: COLUMN_ID,
        buffer: Buffer.from("image"),
        originalFilename: "ayuda.jpg",
      }),
    ).rejects.toBeInstanceOf(AuthForbiddenError);
  });

  it("USUARIO no accede a ayuda de columna oculta", async () => {
    mockRequireAuth(usuarioUserFixture);
    vi.mocked(columnRepository.findById).mockResolvedValue(
      createColumnFixture({
        visibleToNormalUser: false,
        helpText: "Secreto",
        helpImagePath: `${FOLDER_ID}/${COLUMN_ID}/img.jpg`,
      }),
    );

    await expect(columnHelpService.getColumnHelp(COLUMN_ID)).rejects.toMatchObject({
      code: "COLUMN_NOT_FOUND",
    });
  });

  it("USUARIO recibe ayuda solo en columnas visibles al resolver lista", async () => {
    const visible = createColumnFixture({
      id: "visible-col",
      helpText: "Visible",
      visibleToNormalUser: true,
    });
    const hidden = createColumnFixture({
      id: "hidden-col",
      helpText: "Oculto",
      visibleToNormalUser: false,
      helpImagePath: "path.jpg",
    });

    const items = await columnHelpService.resolveHelpForColumns(
      [visible, hidden],
      "USUARIO",
    );

    expect(items[0]?.hasContextualHelp).toBe(true);
    expect(items[1]?.hasContextualHelp).toBe(false);
    expect(items[1]?.helpText).toBeNull();
  });
});
