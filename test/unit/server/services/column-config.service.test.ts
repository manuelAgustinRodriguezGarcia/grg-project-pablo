import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForbiddenError } from "@/server/auth/errors";
import { columnRepository } from "@/server/repositories/column.repository";
import { folderRepository } from "@/server/repositories/folder.repository";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/services/audit.constants";
import { auditService } from "@/server/services/audit.service";
import { columnConfigService } from "@/server/services/column-config.service";
import {
  adminUserFixture,
  consultaUserFixture,
  mockRequireAuth,
  mockRequireRole,
  mockRequireRoleForbidden,
} from "../../../helpers/mocks/auth";
import { createColumnFixture, COLUMN_ID } from "../../../helpers/fixtures/column.fixture";
import { FOLDER_ID } from "../../../helpers/fixtures/folder.fixture";
import {
  mockColumnExists,
  setupColumnRepositoryMocks,
} from "../../../helpers/mocks/column.repository";
import { createFolderFixture } from "../../../helpers/fixtures/folder.fixture";

vi.mock("@/server/auth", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/server/repositories/column.repository", () => ({
  columnRepository: {
    findByFolderIdOrdered: vi.fn(),
    findById: vi.fn(),
    findManyByIds: vi.fn(),
    countPrimaryCodeByFolder: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
    getNextOrder: vi.fn(),
    isUniqueConstraintError: vi.fn(),
  },
}));
vi.mock("@/server/repositories/folder.repository", () => ({
  folderRepository: {
    findById: vi.fn(),
  },
}));
vi.mock("@/server/services/audit.service", () => ({
  auditService: {
    logOperation: vi.fn(),
    logOperationSafe: vi.fn(),
  },
}));

describe("ColumnConfigService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole(adminUserFixture);
    setupColumnRepositoryMocks();
    vi.mocked(folderRepository.findById).mockResolvedValue(createFolderFixture());
    mockColumnExists();
  });

  it("crea una columna y registra auditoría", async () => {
    const column = await columnConfigService.createColumn({
      folderId: FOLDER_ID,
      originalName: "Código",
      displayName: "Código",
      internalKey: "codigo",
      isPrimaryCode: true,
    });

    expect(column.internalKey).toBe("codigo");
    expect(auditService.logOperationSafe).toHaveBeenCalledWith({
      userId: adminUserFixture.id,
      action: AUDIT_ACTIONS.COLUMN_CREATED,
      entityType: AUDIT_ENTITY_TYPES.COLUMN,
      entityId: column.id,
    });
  });

  it("rechaza crear columna sin permisos ADMIN", async () => {
    mockRequireRoleForbidden();

    await expect(
      columnConfigService.createColumn({
        folderId: FOLDER_ID,
        originalName: "Código",
        displayName: "Código",
        internalKey: "codigo",
      }),
    ).rejects.toBeInstanceOf(AuthForbiddenError);
  });

  it("rechaza un segundo código principal en la misma carpeta", async () => {
    vi.mocked(columnRepository.countPrimaryCodeByFolder).mockResolvedValue(1);

    await expect(
      columnConfigService.createColumn({
        folderId: FOLDER_ID,
        originalName: "Referencia",
        displayName: "Referencia",
        internalKey: "referencia",
        isPrimaryCode: true,
      }),
    ).rejects.toMatchObject({ code: "COLUMN_PRIMARY_CODE_CONFLICT" });
  });

  it("lista columnas visibles para CONSULTA", async () => {
    mockRequireAuth(consultaUserFixture);
    vi.mocked(columnRepository.findByFolderIdOrdered).mockResolvedValue([
      createColumnFixture({ visibleToNormalUser: true }),
    ]);

    const columns = await columnConfigService.listColumnsForUser(FOLDER_ID);

    expect(columns).toHaveLength(1);
    expect(columnRepository.findByFolderIdOrdered).toHaveBeenCalledWith(
      FOLDER_ID,
      { visibleToNormalUser: true },
    );
  });

  it("actualiza visibilidad de columna", async () => {
    vi.mocked(columnRepository.update).mockResolvedValue(
      createColumnFixture({ visibleToNormalUser: false }),
    );

    const column = await columnConfigService.setColumnVisibility(COLUMN_ID, false);

    expect(column.visibleToNormalUser).toBe(false);
    expect(auditService.logOperationSafe).toHaveBeenCalledWith({
      userId: adminUserFixture.id,
      action: AUDIT_ACTIONS.COLUMN_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.COLUMN,
      entityId: COLUMN_ID,
    });
  });
});
