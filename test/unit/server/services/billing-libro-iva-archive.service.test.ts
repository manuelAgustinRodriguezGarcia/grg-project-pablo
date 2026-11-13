import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  libroIvaMonthRange,
  libroIvaMonthlyFilename,
  type LibroIvaRow,
} from "@/features/billing/utils/libro-iva";
import { requirePermission } from "@/server/auth";
import { AuthForbiddenError } from "@/server/auth/errors";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import {
  billingLibroIvaArchiveRepository,
  type BillingLibroIvaArchiveRecord,
} from "@/server/repositories/billing-libro-iva-archive.repository";
import { BillingLibroIvaArchiveError } from "@/server/services/billing-libro-iva-archive.errors";
import {
  billingLibroIvaArchiveService,
  billingLibroIvaArchiveStoragePath,
} from "@/server/services/billing-libro-iva-archive.service";
import { fileSha256, fiscalDataSha256 } from "@/server/services/billing-libro-iva-fiscal-fingerprint";
import { loadLibroIvaSource } from "@/server/services/billing-libro-iva-source";
import { StorageError } from "@/server/storage/errors";
import {
  downloadFile,
  listStorageFileNames,
  storageObjectExists,
  uploadFile,
} from "@/server/storage/storage.service";
import { STORAGE_BUCKETS } from "@/server/storage/types";

vi.mock("@/server/auth", () => ({
  requirePermission: vi.fn(),
}));
vi.mock("@/server/repositories/billing-fiscal-settings.repository", () => ({
  billingFiscalSettingsRepository: {
    getOrCreate: vi.fn(),
  },
}));
vi.mock("@/server/repositories/billing-libro-iva-archive.repository", () => ({
  billingLibroIvaArchiveRepository: {
    findByIdentity: vi.fn(),
    findById: vi.fn(),
    findByIds: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    isUniqueConstraintError: vi.fn(),
  },
}));
vi.mock("@/server/services/billing-libro-iva-source", () => ({
  loadLibroIvaSource: vi.fn(),
}));
vi.mock("@/server/storage/storage.service", () => ({
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
  storageObjectExists: vi.fn(),
  listStorageFileNames: vi.fn(),
}));

const USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const CLOSED_NOW = new Date("2026-11-10T15:00:00.000Z");
const ARCHIVE_ID = `c${"a".repeat(24)}`;

type MemoryRecord = BillingLibroIvaArchiveRecord;

function sampleRow(total = 1210): LibroIvaRow {
  return {
    issuedAt: new Date("2026-10-02T15:00:00.000Z"),
    docKind: "FACTURA",
    letter: "B",
    pointOfSale: "0007",
    number: "0007-00000001",
    clientName: "Cliente",
    identification: "30-71234567-1",
    ivaCondition: "RI",
    ivaPercent: 21,
    netAmount: 1000,
    ivaAmount: 210,
    total,
    associatedNumber: "",
  };
}

function input(overrides: {
  environment?: "PRODUCCION" | "HOMOLOGACION" | "MODO_PRUEBA";
  year?: number;
  month?: number;
  format?: "PDF" | "XLSX";
  bytes?: Uint8Array;
  rows?: LibroIvaRow[];
} = {}) {
  const environment = overrides.environment ?? "PRODUCCION";
  const year = overrides.year ?? 2026;
  const month = overrides.month ?? 10;
  const format = overrides.format ?? "PDF";
  const extension = format === "PDF" ? "pdf" : "xlsx";
  return {
    environment,
    year,
    month,
    format,
    bytes: overrides.bytes ?? new Uint8Array([9, 8, 7, 6]),
    filename: libroIvaMonthlyFilename(year, month, extension),
    rows: overrides.rows ?? [sampleRow()],
    generatedByUserId: USER_ID,
  };
}

function copyUploadBody(body: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(body)) {
    return Buffer.from(body);
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }
  return Buffer.from(body);
}

function installMemory() {
  const files = new Map<string, Buffer>();
  const records: MemoryRecord[] = [];

  const matches = (
    record: MemoryRecord,
    identity: {
      environment: string;
      bookKind: string;
      year: number;
      month: number;
      format: string;
    },
  ) =>
    record.environment === identity.environment &&
    record.bookKind === identity.bookKind &&
    record.year === identity.year &&
    record.month === identity.month &&
    record.format === identity.format;

  vi.mocked(billingLibroIvaArchiveRepository.findByIdentity).mockImplementation(
    async (identity) => records.find((record) => matches(record, identity)) ?? null,
  );
  vi.mocked(billingLibroIvaArchiveRepository.findById).mockImplementation(
    async (id) => records.find((record) => record.id === id) ?? null,
  );
  vi.mocked(billingLibroIvaArchiveRepository.findByIds).mockImplementation(
    async (ids, environment) =>
      records.filter(
        (record) => ids.includes(record.id) && record.environment === environment,
      ),
  );
  vi.mocked(billingLibroIvaArchiveRepository.create).mockImplementation(async (data) => {
    if (records.some((record) => matches(record, data))) {
      throw new Error("unique");
    }
    const now = new Date("2026-11-10T15:00:00.000Z");
    const record: MemoryRecord = {
      ...data,
      id: `c${String(records.length + 1).padStart(24, "0")}`,
      createdAt: now,
      updatedAt: now,
      generatedBy: { id: data.generatedByUserId, name: "Admin" },
    };
    records.push(record);
    return record;
  });
  vi.mocked(billingLibroIvaArchiveRepository.isUniqueConstraintError).mockImplementation(
    (error) => error instanceof Error && error.message === "unique",
  );
  vi.mocked(uploadFile).mockImplementation(async (file) => {
    if (files.has(file.path)) {
      throw new StorageError(
        "Error al subir archivo: El archivo ya existe en Storage. Intente de nuevo.",
      );
    }
    const body = copyUploadBody(file.body);
    files.set(file.path, body);
    return {
      bucket: file.bucket,
      path: file.path,
      sizeBytes: body.byteLength,
      contentType: file.contentType,
    };
  });
  vi.mocked(downloadFile).mockImplementation(async (_bucket, path) => {
    const stored = files.get(path);
    if (!stored) {
      throw new StorageError("missing");
    }
    return Buffer.from(stored);
  });
  vi.mocked(listStorageFileNames).mockImplementation(async (_bucket, folder) => {
    const prefix = folder.endsWith("/") || folder.length === 0 ? folder : `${folder}/`;
    return [...files.keys()]
      .filter((path) => path.startsWith(prefix))
      .map((path) => path.slice(prefix.length))
      .filter((name) => name.length > 0 && !name.includes("/"));
  });

  return { files, records };
}

describe("archivado de libros de IVA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(requirePermission).mockResolvedValue({
      profile: {
        id: USER_ID,
        email: "agencygrg@gmail.com",
        role: "ADMINISTRADOR",
      },
    } as never);
    vi.mocked(billingFiscalSettingsRepository.getOrCreate).mockResolvedValue({
      environment: "PRODUCCION",
    } as never);
    vi.mocked(loadLibroIvaSource).mockResolvedValue({
      rows: [sampleRow()],
      environment: "PRODUCCION",
    } as never);
    vi.mocked(storageObjectExists).mockResolvedValue(true);
  });

  it("archiva la primera descarga de un mes cerrado con los mismos bytes", async () => {
    const memory = installMemory();
    const payload = input();

    const result = await billingLibroIvaArchiveService.retainMonthlyCopy(
      payload,
      CLOSED_NOW,
    );

    expect(result).toMatchObject({ status: "archived" });
    expect(memory.records).toHaveLength(1);
    expect(memory.files.size).toBe(1);
    const stored = memory.files.get(
      billingLibroIvaArchiveStoragePath({
        environment: "PRODUCCION",
        year: 2026,
        month: 10,
        format: "PDF",
      }),
    );
    expect(stored?.equals(Buffer.from(payload.bytes))).toBe(true);
    expect(memory.records[0]).toMatchObject({
      environment: "PRODUCCION",
      bookKind: "MONTHLY",
      year: 2026,
      month: 10,
      format: "PDF",
      fileName: payload.filename,
      sizeBytes: payload.bytes.byteLength,
      fileSha256: fileSha256(payload.bytes),
      fiscalDataSha256: fiscalDataSha256("PRODUCCION", payload.rows),
      generatedByUserId: USER_ID,
    });
    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: STORAGE_BUCKETS.BILLING_LIBRO_IVA_ARCHIVES,
        upsert: false,
      }),
    );
  });

  it("no crea otro archivo en la segunda descarga y detecta un cambio fiscal", async () => {
    const memory = installMemory();
    const first = input();
    await billingLibroIvaArchiveService.retainMonthlyCopy(first, CLOSED_NOW);
    vi.mocked(uploadFile).mockClear();

    const changed = input({ rows: [sampleRow(50)] });
    const second = await billingLibroIvaArchiveService.retainMonthlyCopy(
      changed,
      CLOSED_NOW,
    );

    expect(second).toMatchObject({
      status: "already-archived",
      fiscalSourceChanged: true,
    });
    expect(memory.records).toHaveLength(1);
    expect(memory.files.size).toBe(1);
    expect(uploadFile).not.toHaveBeenCalled();
    expect(memory.records[0]?.fiscalDataSha256).toBe(
      fiscalDataSha256("PRODUCCION", first.rows),
    );
  });

  it("guarda PDF y Excel del mismo mes como archivos distintos", async () => {
    const memory = installMemory();
    await billingLibroIvaArchiveService.retainMonthlyCopy(input(), CLOSED_NOW);
    await billingLibroIvaArchiveService.retainMonthlyCopy(
      input({ format: "XLSX", bytes: new Uint8Array([4, 5, 6]) }),
      CLOSED_NOW,
    );

    expect(memory.records.map((record) => record.format).sort()).toEqual([
      "PDF",
      "XLSX",
    ]);
    expect([...memory.files.keys()].sort()).toEqual([
      "libros-iva/MONTHLY/PRODUCCION/2026/10/libro.pdf",
      "libros-iva/MONTHLY/PRODUCCION/2026/10/libro.xlsx",
    ]);
  });

  it("separa PRODUCCION, HOMOLOGACION y MODO_PRUEBA", async () => {
    const memory = installMemory();
    for (const environment of ["PRODUCCION", "HOMOLOGACION", "MODO_PRUEBA"] as const) {
      const result = await billingLibroIvaArchiveService.retainMonthlyCopy(
        input({ environment }),
        CLOSED_NOW,
      );
      expect(result.status).toBe("archived");
    }

    expect(memory.records.map((record) => record.environment).sort()).toEqual([
      "HOMOLOGACION",
      "MODO_PRUEBA",
      "PRODUCCION",
    ]);
    expect(memory.files.size).toBe(3);
  });

  it("no archiva el mes en curso ni un mes que todavía no terminó en Argentina", async () => {
    installMemory();

    const currentMonth = await billingLibroIvaArchiveService.retainMonthlyCopy(
      input({ month: 11 }),
      CLOSED_NOW,
    );
    const stillOctober = await billingLibroIvaArchiveService.retainMonthlyCopy(
      input(),
      new Date("2026-11-01T02:59:59.999Z"),
    );

    expect(currentMonth).toEqual({ status: "skipped", reason: "month-open" });
    expect(stillOctober).toEqual({ status: "skipped", reason: "month-open" });
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("archiva un año anterior y el mes que acaba de cerrar en Argentina", async () => {
    const memory = installMemory();

    const previousYear = await billingLibroIvaArchiveService.retainMonthlyCopy(
      input({ year: 2025, month: 12 }),
      CLOSED_NOW,
    );
    const justClosed = await billingLibroIvaArchiveService.retainMonthlyCopy(
      input(),
      new Date("2026-11-01T03:00:00.000Z"),
    );
    const december = await billingLibroIvaArchiveService.retainMonthlyCopy(
      input({ year: 2026, month: 12 }),
      new Date("2027-01-01T03:00:00.000Z"),
    );
    const decemberStillOpen = await billingLibroIvaArchiveService.retainMonthlyCopy(
      input({ year: 2026, month: 12, format: "XLSX" }),
      new Date("2027-01-01T02:59:59.999Z"),
    );

    expect(previousYear.status).toBe("archived");
    expect(justClosed.status).toBe("archived");
    expect(december.status).toBe("archived");
    expect(decemberStillOpen).toEqual({ status: "skipped", reason: "month-open" });
    expect(memory.records).toHaveLength(3);
  });

  it("resiste dos descargas simultáneas del mismo archivo", async () => {
    const memory = installMemory();
    let started = 0;
    let release: () => void = () => {};
    const bothStarted = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(uploadFile).mockImplementation(async (file) => {
      started += 1;
      if (started >= 2) {
        release();
      }
      await bothStarted;
      if (memory.files.has(file.path)) {
        throw new StorageError(
          "Error al subir archivo: El archivo ya existe en Storage. Intente de nuevo.",
        );
      }
      const body = copyUploadBody(file.body);
      memory.files.set(file.path, body);
      return {
        bucket: file.bucket,
        path: file.path,
        sizeBytes: body.byteLength,
        contentType: file.contentType,
      };
    });

    const payload = input();
    const results = await Promise.all([
      billingLibroIvaArchiveService.retainMonthlyCopy(payload, CLOSED_NOW),
      billingLibroIvaArchiveService.retainMonthlyCopy(payload, CLOSED_NOW),
    ]);

    expect(memory.files.size).toBe(1);
    expect(memory.records).toHaveLength(1);
    expect(results.every((result) => result.status !== "failed")).toBe(true);
    expect(memory.records[0]?.fileSha256).toBe(fileSha256(payload.bytes));
  });

  it("no sobrescribe el archivo si la descarga simultánea trae otros bytes", async () => {
    const memory = installMemory();
    let started = 0;
    let release: () => void = () => {};
    const bothStarted = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(uploadFile).mockImplementation(async (file) => {
      started += 1;
      if (started >= 2) {
        release();
      }
      await bothStarted;
      if (memory.files.has(file.path)) {
        throw new StorageError(
          "Error al subir archivo: El archivo ya existe en Storage. Intente de nuevo.",
        );
      }
      const body = copyUploadBody(file.body);
      memory.files.set(file.path, body);
      return {
        bucket: file.bucket,
        path: file.path,
        sizeBytes: body.byteLength,
        contentType: file.contentType,
      };
    });

    const first = input({ bytes: new Uint8Array([1, 1, 1]) });
    const second = input({ bytes: new Uint8Array([2, 2, 2]) });
    const results = await Promise.all([
      billingLibroIvaArchiveService.retainMonthlyCopy(first, CLOSED_NOW),
      billingLibroIvaArchiveService.retainMonthlyCopy(second, CLOSED_NOW),
    ]);

    expect(memory.files.size).toBe(1);
    expect(memory.records).toHaveLength(1);
    const stored = [...memory.files.values()][0];
    expect(stored).toBeDefined();
    expect(memory.records[0]?.fileSha256).toBe(fileSha256(stored!));
    const archived = results.filter((result) => result.status === "archived");
    const other = results.filter((result) => result.status !== "archived");
    expect(archived).toHaveLength(1);
    expect(other[0]?.status === "already-archived" || other[0]?.status === "failed").toBe(
      true,
    );
    if (other[0]?.status === "failed") {
      expect(other[0].reason).toBe("orphan-mismatch");
    }
    const storedIsFirst = stored!.equals(Buffer.from(first.bytes));
    const storedIsSecond = stored!.equals(Buffer.from(second.bytes));
    expect(storedIsFirst || storedIsSecond).toBe(true);
    expect(storedIsFirst && storedIsSecond).toBe(false);
  });

  it("no marca como archivado un fallo de Storage", async () => {
    installMemory();
    vi.mocked(uploadFile).mockRejectedValue(new StorageError("Bucket not found"));

    const result = await billingLibroIvaArchiveService.retainMonthlyCopy(
      input(),
      CLOSED_NOW,
    );

    expect(result).toEqual({ status: "failed", reason: "storage" });
    expect(billingLibroIvaArchiveRepository.create).not.toHaveBeenCalled();
  });

  it("si la base falla después de subir, no lo da por archivado y un reintento idéntico lo registra", async () => {
    const memory = installMemory();
    vi.mocked(billingLibroIvaArchiveRepository.create).mockRejectedValueOnce(
      new Error("db down"),
    );

    const payload = input();
    const failed = await billingLibroIvaArchiveService.retainMonthlyCopy(
      payload,
      CLOSED_NOW,
    );

    expect(failed).toEqual({ status: "failed", reason: "database" });
    expect(memory.records).toHaveLength(0);
    expect(memory.files.size).toBe(1);

    const retried = await billingLibroIvaArchiveService.retainMonthlyCopy(
      payload,
      CLOSED_NOW,
    );

    expect(retried.status).toBe("archived");
    expect(memory.records).toHaveLength(1);
    expect(memory.files.size).toBe(1);
    expect(
      [...memory.files.values()][0]?.equals(Buffer.from(payload.bytes)),
    ).toBe(true);
  });

  it("no reemplaza un archivo huérfano si los bytes nuevos no coinciden", async () => {
    const memory = installMemory();
    const original = input({ bytes: new Uint8Array([3, 3, 3]) });
    vi.mocked(billingLibroIvaArchiveRepository.create).mockRejectedValueOnce(
      new Error("db down"),
    );
    await billingLibroIvaArchiveService.retainMonthlyCopy(original, CLOSED_NOW);

    const different = await billingLibroIvaArchiveService.retainMonthlyCopy(
      input({ bytes: new Uint8Array([4, 4, 4]) }),
      CLOSED_NOW,
    );

    expect(different).toEqual({ status: "failed", reason: "orphan-mismatch" });
    expect(memory.records).toHaveLength(0);
    expect([...memory.files.values()][0]?.equals(Buffer.from(original.bytes))).toBe(
      true,
    );
  });

  it("rechaza listar, ver y descargar sin permiso", async () => {
    installMemory();
    vi.mocked(requirePermission).mockRejectedValue(new AuthForbiddenError());

    await expect(
      billingLibroIvaArchiveService.listArchives({ year: null, month: null }),
    ).rejects.toBeInstanceOf(AuthForbiddenError);
    await expect(
      billingLibroIvaArchiveService.getArchive(ARCHIVE_ID),
    ).rejects.toBeInstanceOf(AuthForbiddenError);
    await expect(
      billingLibroIvaArchiveService.downloadArchive(ARCHIVE_ID),
    ).rejects.toBeInstanceOf(AuthForbiddenError);
    expect(billingLibroIvaArchiveRepository.list).not.toHaveBeenCalled();
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it("no acepta identificadores ni rutas arbitrarias", async () => {
    installMemory();

    await expect(
      billingLibroIvaArchiveService.downloadArchive("../secret"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      billingLibroIvaArchiveService.getArchive(`${ARCHIVE_ID}/libro.pdf`),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(downloadFile).not.toHaveBeenCalled();
    expect(billingLibroIvaArchiveRepository.findById).not.toHaveBeenCalled();
  });

  it("no entrega un libro de otro ambiente fiscal", async () => {
    const memory = installMemory();
    await billingLibroIvaArchiveService.retainMonthlyCopy(
      input({ environment: "HOMOLOGACION" }),
      CLOSED_NOW,
    );
    const foreign = memory.records[0];
    expect(foreign).toBeDefined();

    await expect(
      billingLibroIvaArchiveService.downloadArchive(foreign!.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it("informa que el archivo histórico no está y no lo regenera", async () => {
    const memory = installMemory();
    const archived = await billingLibroIvaArchiveService.retainMonthlyCopy(
      input(),
      CLOSED_NOW,
    );
    expect(archived.status).toBe("archived");
    memory.files.clear();
    vi.mocked(uploadFile).mockClear();

    await expect(
      billingLibroIvaArchiveService.downloadArchive(memory.records[0]!.id),
    ).rejects.toBeInstanceOf(BillingLibroIvaArchiveError);
    await expect(
      billingLibroIvaArchiveService.downloadArchive(memory.records[0]!.id),
    ).rejects.toMatchObject({ code: "ARCHIVE_FILE_MISSING" });
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("lista el ambiente actual, filtra año y mes, y marca cambios fiscales", async () => {
    const rows = [sampleRow()];
    const currentHash = fiscalDataSha256("PRODUCCION", rows);
    const archived = {
      id: ARCHIVE_ID,
      environment: "PRODUCCION",
      bookKind: "MONTHLY",
      year: 2026,
      month: 10,
      format: "PDF",
      storagePath: "libros-iva/MONTHLY/PRODUCCION/2026/10/libro.pdf",
      fileName: "Libro-IVA-2026-10.pdf",
      sizeBytes: 4,
      fileSha256: "abc",
      fiscalDataSha256: currentHash,
      generatedAt: CLOSED_NOW,
      generatedByUserId: USER_ID,
      createdAt: CLOSED_NOW,
      updatedAt: CLOSED_NOW,
      generatedBy: { id: USER_ID, name: "Admin" },
    } satisfies MemoryRecord;
    vi.mocked(billingLibroIvaArchiveRepository.list).mockResolvedValue([archived]);
    vi.mocked(loadLibroIvaSource).mockResolvedValue({
      rows,
      environment: "PRODUCCION",
    } as never);

    const same = await billingLibroIvaArchiveService.listArchives({
      year: "2026",
      month: "10",
    });

    expect(billingLibroIvaArchiveRepository.list).toHaveBeenCalledWith({
      environment: "PRODUCCION",
      year: 2026,
      month: 10,
    });
    expect(loadLibroIvaSource).toHaveBeenCalledWith(libroIvaMonthRange(2026, 10));
    expect(same[0]?.fiscalSourceChanged).toBe(false);
    expect(same[0]?.issued).toEqual({
      facturasA: { count: 0, total: 0 },
      facturasB: { count: 1, total: 1210 },
      notasCredito: { count: 0, total: 0 },
      notasDebito: { count: 0, total: 0 },
    });
    expect(same[0]).not.toHaveProperty("storagePath");

    vi.mocked(loadLibroIvaSource).mockResolvedValue({
      rows: [sampleRow(1)],
      environment: "PRODUCCION",
    } as never);
    const changed = await billingLibroIvaArchiveService.listArchives({
      year: "2026",
      month: null,
    });
    expect(changed[0]?.fiscalSourceChanged).toBe(true);

    vi.mocked(loadLibroIvaSource).mockRejectedValue(new Error("db"));
    const unknown = await billingLibroIvaArchiveService.listArchives({
      year: null,
      month: null,
    });
    expect(unknown[0]?.fiscalSourceChanged).toBeNull();
    expect(unknown[0]?.issued).toBeNull();
  });

  it("rechaza un mes sin año", async () => {
    await expect(
      billingLibroIvaArchiveService.listArchives({ year: null, month: "10" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("la descarga histórica devuelve los bytes guardados, no una generación nueva", async () => {
    const memory = installMemory();
    const payload = input({ bytes: new Uint8Array([8, 6, 7, 5, 3, 0, 9]) });
    const archived = await billingLibroIvaArchiveService.retainMonthlyCopy(
      payload,
      CLOSED_NOW,
    );
    expect(archived.status).toBe("archived");
    vi.mocked(uploadFile).mockClear();

    const file = await billingLibroIvaArchiveService.downloadArchive(
      memory.records[0]!.id,
    );

    expect(file.bytes.equals(Buffer.from(payload.bytes))).toBe(true);
    expect(file.filename).toBe(payload.filename);
    expect(file.contentType).toBe("application/pdf");
    expect(uploadFile).not.toHaveBeenCalled();
    expect(downloadFile).toHaveBeenCalledWith(
      STORAGE_BUCKETS.BILLING_LIBRO_IVA_ARCHIVES,
      memory.records[0]!.storagePath,
    );
  });

  it("comprueba archivos presentes y ausentes por carpeta, sin recargar el libro", async () => {
    const memory = installMemory();
    expect((await billingLibroIvaArchiveService.retainMonthlyCopy(input(), CLOSED_NOW)).status).toBe("archived");
    expect((await billingLibroIvaArchiveService.retainMonthlyCopy(
      input({ format: "XLSX", bytes: new Uint8Array([1, 2]) }),
      CLOSED_NOW,
    )).status).toBe("archived");
    expect((await billingLibroIvaArchiveService.retainMonthlyCopy(
      input({ month: 9, bytes: new Uint8Array([3]) }),
      CLOSED_NOW,
    )).status).toBe("archived");
    expect((await billingLibroIvaArchiveService.retainMonthlyCopy(
      input({ environment: "HOMOLOGACION", month: 8, bytes: new Uint8Array([4]) }),
      CLOSED_NOW,
    )).status).toBe("archived");

    const pdf = memory.records.find((record) => record.month === 10 && record.format === "PDF");
    const xlsx = memory.records.find((record) => record.format === "XLSX");
    const september = memory.records.find((record) => record.month === 9);
    const homologacion = memory.records.find((record) => record.environment === "HOMOLOGACION");
    expect(pdf && xlsx && september && homologacion).toBeTruthy();
    memory.files.delete(september!.storagePath);

    vi.mocked(loadLibroIvaSource).mockClear();
    vi.mocked(downloadFile).mockClear();
    vi.mocked(storageObjectExists).mockClear();
    vi.mocked(listStorageFileNames).mockClear();

    const unknownId = `c${"z".repeat(24)}`;
    const result = await billingLibroIvaArchiveService.listFilePresence([
      pdf!.id,
      xlsx!.id,
      september!.id,
      homologacion!.id,
      unknownId,
      pdf!.id,
    ]);

    expect(result).toEqual([
      { id: pdf!.id, filePresent: true },
      { id: xlsx!.id, filePresent: true },
      { id: september!.id, filePresent: false },
      { id: homologacion!.id, filePresent: null },
      { id: unknownId, filePresent: null },
    ]);
    const folders = vi.mocked(listStorageFileNames).mock.calls.map((call) => String(call[1]));
    expect(folders.filter((folder) => folder.includes("/2026/10"))).toHaveLength(1);
    expect(folders.filter((folder) => folder.includes("/2026/09"))).toHaveLength(1);
    expect(folders.some((folder) => folder.includes("HOMOLOGACION"))).toBe(false);
    expect(folders).toHaveLength(2);
    expect(loadLibroIvaSource).not.toHaveBeenCalled();
    expect(downloadFile).not.toHaveBeenCalled();
    expect(storageObjectExists).not.toHaveBeenCalled();
  });

  it("deja la presencia sin verificar cuando Storage no responde", async () => {
    const memory = installMemory();
    const archived = await billingLibroIvaArchiveService.retainMonthlyCopy(input(), CLOSED_NOW);
    expect(archived.status).toBe("archived");
    vi.mocked(listStorageFileNames).mockRejectedValue(new StorageError("down"));
    vi.mocked(loadLibroIvaSource).mockClear();

    const result = await billingLibroIvaArchiveService.listFilePresence([
      memory.records[0]!.id,
    ]);

    expect(result).toEqual([{ id: memory.records[0]!.id, filePresent: null }]);
    expect(loadLibroIvaSource).not.toHaveBeenCalled();
    expect(downloadFile).not.toHaveBeenCalled();
  });
});
