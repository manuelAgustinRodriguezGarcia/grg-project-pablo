import { timingSafeEqual } from "node:crypto";
import type {
  BillingFiscalEnvironment,
  BillingLibroIvaArchiveFormat,
  BillingLibroIvaBookKind,
} from "@/generated/prisma/client";
import type { LibroIvaIssuedSummary, LibroIvaRow } from "@/features/billing/utils/libro-iva";
import { libroIvaMonthRange, summarizeLibroIvaIssued } from "@/features/billing/utils/libro-iva";
import { requirePermission } from "@/server/auth";
import { AuthForbiddenError } from "@/server/auth/errors";
import { canPreviewBillingSections } from "@/shared/auth/billing-section-preview";
import { billingFiscalSettingsRepository } from "@/server/repositories/billing-fiscal-settings.repository";
import {
  billingLibroIvaArchiveRepository,
  type BillingLibroIvaArchiveRecord,
} from "@/server/repositories/billing-libro-iva-archive.repository";
import { BillingLibroIvaArchiveError } from "@/server/services/billing-libro-iva-archive.errors";
import { isArgentinaCalendarMonthClosed } from "@/server/services/billing-libro-iva-archive-eligibility";
import {
  fileSha256,
  fiscalDataSha256,
} from "@/server/services/billing-libro-iva-fiscal-fingerprint";
import { loadLibroIvaSource } from "@/server/services/billing-libro-iva-source";
import { StorageError } from "@/server/storage/errors";
import {
  downloadFile,
  listStorageFileNames,
  storageObjectExists,
  uploadFile,
} from "@/server/storage/storage.service";
import { STORAGE_BUCKETS } from "@/server/storage/types";

const ARCHIVE_BUCKET = STORAGE_BUCKETS.BILLING_LIBRO_IVA_ARCHIVES;
const PRESENCE_BATCH_LIMIT = 48;
const PRESENCE_LIST_CONCURRENCY = 4;
const PDF_CONTENT_TYPE = "application/pdf";
const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ARCHIVE_ID_PATTERN = /^c[a-z0-9]{24}$/;

export type RetainMonthlyLibroIvaInput = {
  environment: BillingFiscalEnvironment;
  year: number;
  month: number;
  format: BillingLibroIvaArchiveFormat;
  bytes: Uint8Array;
  filename: string;
  rows: readonly LibroIvaRow[];
  generatedByUserId: string;
};

export type RetainMonthlyLibroIvaResult =
  | { status: "skipped"; reason: "month-open" }
  | { status: "already-archived"; archiveId: string; fiscalSourceChanged: boolean }
  | { status: "archived"; archiveId: string }
  | {
      status: "failed";
      reason: "storage" | "database" | "orphan-mismatch" | "unexpected";
    };

export type BillingLibroIvaArchiveSummary = {
  id: string;
  environment: BillingFiscalEnvironment;
  bookKind: "MONTHLY";
  year: number;
  month: number;
  format: BillingLibroIvaArchiveFormat;
  fileName: string;
  sizeBytes: number;
  fileSha256: string;
  fiscalDataSha256: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
  generatedBy: { id: string; name: string };
  fiscalSourceChanged: boolean | null;
  issued: LibroIvaIssuedSummary | null;
};

export type BillingLibroIvaArchiveDetail = BillingLibroIvaArchiveSummary & {
  filePresent: boolean | null;
};

export type BillingLibroIvaArchiveFile = {
  bytes: Buffer;
  filename: string;
  contentType: string;
};

type ListQuery = {
  year: string | null;
  month: string | null;
};

function logArchiveFailure(
  reason: string,
  details: Record<string, string | number>,
  error?: unknown,
): void {
  console.error("[billing-libro-iva-archive]", reason, details, error);
}

function sameHash(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  return timingSafeEqual(leftBytes, rightBytes);
}

function isStorageObjectAlreadyExists(error: unknown): boolean {
  if (!(error instanceof StorageError)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("ya existe") || message.includes("already exists");
}

function archiveExtension(format: BillingLibroIvaArchiveFormat): "pdf" | "xlsx" {
  switch (format) {
    case "PDF":
      return "pdf";
    case "XLSX":
      return "xlsx";
    default: {
      const unexpected: never = format;
      return unexpected;
    }
  }
}

export function billingLibroIvaArchiveStoragePath(input: {
  environment: BillingFiscalEnvironment;
  year: number;
  month: number;
  format: BillingLibroIvaArchiveFormat;
}): string {
  const month = String(input.month).padStart(2, "0");
  const extension = archiveExtension(input.format);
  return `libros-iva/MONTHLY/${input.environment}/${input.year}/${month}/libro.${extension}`;
}

function contentTypeFor(format: BillingLibroIvaArchiveFormat): string {
  switch (format) {
    case "PDF":
      return PDF_CONTENT_TYPE;
    case "XLSX":
      return XLSX_CONTENT_TYPE;
    default: {
      const unexpected: never = format;
      return unexpected;
    }
  }
}

function downloadFilename(
  fileName: string,
  format: BillingLibroIvaArchiveFormat,
): string {
  const base = fileName.split(/[/\\]/).pop() ?? "";
  switch (format) {
    case "PDF":
      return base.endsWith(".pdf") ? base : "Libro-IVA.pdf";
    case "XLSX":
      return base.endsWith(".xlsx") ? base : "Libro-IVA.xlsx";
    default: {
      const unexpected: never = format;
      return unexpected;
    }
  }
}

function splitStoragePath(path: string): { folder: string; fileName: string } {
  const slash = path.lastIndexOf("/");
  if (slash < 0) {
    return { folder: "", fileName: path };
  }

  return {
    folder: path.slice(0, slash),
    fileName: path.slice(slash + 1),
  };
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index] as T);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => run(),
  );
  await Promise.all(workers);
  return results;
}

function assertArchiveId(id: string): void {
  if (!ARCHIVE_ID_PATTERN.test(id)) {
    throw new BillingLibroIvaArchiveError(
      "El identificador del libro archivado no es válido.",
      "VALIDATION_ERROR",
    );
  }
}

function parseQueryInt(value: string | null, label: string): number | undefined {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  if (!/^\d{1,4}$/.test(value)) {
    throw new BillingLibroIvaArchiveError(
      `Indicá un ${label} válido.`,
      "VALIDATION_ERROR",
    );
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BillingLibroIvaArchiveError(
      `Indicá un ${label} válido.`,
      "VALIDATION_ERROR",
    );
  }

  return parsed;
}

function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function archivedBookKind(kind: BillingLibroIvaBookKind): "MONTHLY" {
  switch (kind) {
    case "MONTHLY":
      return "MONTHLY";
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}

function toSummary(
  record: BillingLibroIvaArchiveRecord,
  fiscalSourceChanged: boolean | null,
  issued: LibroIvaIssuedSummary | null,
): BillingLibroIvaArchiveSummary {
  return {
    id: record.id,
    environment: record.environment,
    bookKind: archivedBookKind(record.bookKind),
    year: record.year,
    month: record.month,
    format: record.format,
    fileName: record.fileName,
    sizeBytes: record.sizeBytes,
    fileSha256: record.fileSha256,
    fiscalDataSha256: record.fiscalDataSha256,
    generatedAt: record.generatedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    generatedBy: {
      id: record.generatedBy.id,
      name: record.generatedBy.name,
    },
    fiscalSourceChanged,
    issued,
  };
}

export class BillingLibroIvaArchiveService {
  async retainMonthlyCopy(
    input: RetainMonthlyLibroIvaInput,
    now: Date = new Date(),
  ): Promise<RetainMonthlyLibroIvaResult> {
    try {
      return await this.retainMonthlyCopyUnsafe(input, now);
    } catch (error) {
      logArchiveFailure(
        "No se archivó el libro. La descarga generada no se modifica.",
        {
          environment: input.environment,
          year: input.year,
          month: input.month,
          format: input.format,
        },
        error,
      );
      return { status: "failed", reason: "unexpected" };
    }
  }

  private async retainMonthlyCopyUnsafe(
    input: RetainMonthlyLibroIvaInput,
    now: Date,
  ): Promise<RetainMonthlyLibroIvaResult> {
    if (
      !Number.isInteger(input.year) ||
      !Number.isInteger(input.month) ||
      input.month < 1 ||
      input.month > 12
    ) {
      logArchiveFailure("Período inválido. No se archivó.", {
        environment: input.environment,
        year: input.year,
        month: input.month,
        format: input.format,
      });
      return { status: "failed", reason: "unexpected" };
    }

    if (!isArgentinaCalendarMonthClosed(input.year, input.month, now)) {
      return { status: "skipped", reason: "month-open" };
    }

    const fingerprint = fiscalDataSha256(input.environment, input.rows);
    const bytesHash = fileSha256(input.bytes);
    const identity = {
      environment: input.environment,
      bookKind: "MONTHLY" as const,
      year: input.year,
      month: input.month,
      format: input.format,
    };
    const existing = await billingLibroIvaArchiveRepository.findByIdentity(identity);
    if (existing) {
      return {
        status: "already-archived",
        archiveId: existing.id,
        fiscalSourceChanged: !sameHash(existing.fiscalDataSha256, fingerprint),
      };
    }

    const storagePath = billingLibroIvaArchiveStoragePath(identity);
    const upload = await this.uploadOriginalBytes(
      input,
      storagePath,
      bytesHash,
      fingerprint,
    );
    if (upload.status !== "uploaded") {
      return upload;
    }

    return this.registerArchive(input, storagePath, bytesHash, fingerprint);
  }

  private async uploadOriginalBytes(
    input: RetainMonthlyLibroIvaInput,
    storagePath: string,
    bytesHash: string,
    fingerprint: string,
  ): Promise<
    | { status: "uploaded" }
    | Extract<
        RetainMonthlyLibroIvaResult,
        { status: "failed" | "already-archived" }
      >
  > {
    try {
      await uploadFile({
        bucket: ARCHIVE_BUCKET,
        path: storagePath,
        body: input.bytes,
        contentType: contentTypeFor(input.format),
        originalFilename: input.filename,
        upsert: false,
        auditContext: { userId: input.generatedByUserId },
      });
      return { status: "uploaded" };
    } catch (error) {
      if (!isStorageObjectAlreadyExists(error)) {
        logArchiveFailure(
          "Falló el almacenamiento. El libro no quedó archivado.",
          {
            environment: input.environment,
            year: input.year,
            month: input.month,
            format: input.format,
          },
          error,
        );
        return { status: "failed", reason: "storage" };
      }
    }

    const raced = await billingLibroIvaArchiveRepository.findByIdentity({
      environment: input.environment,
      bookKind: "MONTHLY",
      year: input.year,
      month: input.month,
      format: input.format,
    });
    if (raced) {
      return {
        status: "already-archived",
        archiveId: raced.id,
        fiscalSourceChanged: !sameHash(raced.fiscalDataSha256, fingerprint),
      };
    }

    return this.adoptMatchingOrphan(input, storagePath, bytesHash);
  }

  private async adoptMatchingOrphan(
    input: RetainMonthlyLibroIvaInput,
    storagePath: string,
    bytesHash: string,
  ): Promise<{ status: "uploaded" } | Extract<RetainMonthlyLibroIvaResult, { status: "failed" }>> {
    try {
      const stored = await downloadFile(ARCHIVE_BUCKET, storagePath);
      if (sameHash(fileSha256(stored), bytesHash)) {
        return { status: "uploaded" };
      }
    } catch (error) {
      logArchiveFailure(
        "El archivo existente no se pudo leer. No se archivó esta descarga.",
        {
          environment: input.environment,
          year: input.year,
          month: input.month,
          format: input.format,
        },
        error,
      );
      return { status: "failed", reason: "storage" };
    }

    logArchiveFailure(
      "Hay un archivo sin registro y no coincide con esta descarga. No se sobrescribe.",
      {
        environment: input.environment,
        year: input.year,
        month: input.month,
        format: input.format,
      },
    );
    return { status: "failed", reason: "orphan-mismatch" };
  }

  private async registerArchive(
    input: RetainMonthlyLibroIvaInput,
    storagePath: string,
    bytesHash: string,
    fingerprint: string,
  ): Promise<RetainMonthlyLibroIvaResult> {
    const identity = {
      environment: input.environment,
      bookKind: "MONTHLY" as const,
      year: input.year,
      month: input.month,
      format: input.format,
    };

    try {
      const created = await billingLibroIvaArchiveRepository.create({
        ...identity,
        storagePath,
        fileName: input.filename,
        sizeBytes: input.bytes.byteLength,
        fileSha256: bytesHash,
        fiscalDataSha256: fingerprint,
        generatedAt: new Date(),
        generatedByUserId: input.generatedByUserId,
      });
      return { status: "archived", archiveId: created.id };
    } catch (error) {
      if (billingLibroIvaArchiveRepository.isUniqueConstraintError(error)) {
        const winner = await billingLibroIvaArchiveRepository.findByIdentity(identity);
        if (winner) {
          return {
            status: "already-archived",
            archiveId: winner.id,
            fiscalSourceChanged: !sameHash(winner.fiscalDataSha256, fingerprint),
          };
        }
      }

      logArchiveFailure(
        "El archivo se subió pero no quedó registrado. No se lo considera archivado.",
        {
          environment: input.environment,
          year: input.year,
          month: input.month,
          format: input.format,
        },
        error,
      );
      return { status: "failed", reason: "database" };
    }
  }

  async listArchives(query: ListQuery): Promise<BillingLibroIvaArchiveSummary[]> {
    await this.authorizeReader();
    const year = parseQueryInt(query.year, "año");
    const month = parseQueryInt(query.month, "mes");
    if (month !== undefined && year === undefined) {
      throw new BillingLibroIvaArchiveError(
        "Indicá el año para filtrar por mes.",
        "VALIDATION_ERROR",
      );
    }
    if (month !== undefined && (month < 1 || month > 12)) {
      throw new BillingLibroIvaArchiveError(
        "Indicá un mes válido.",
        "VALIDATION_ERROR",
      );
    }

    const settings = await billingFiscalSettingsRepository.getOrCreate();
    const records = await billingLibroIvaArchiveRepository.list({
      environment: settings.environment,
      year,
      month,
    });
    const snapshots = await this.currentPeriodSnapshots(
      records,
      settings.environment,
    );

    return records.map((record) => {
      const current = snapshots.get(periodKey(record.year, record.month));
      const fingerprint = current?.fingerprint ?? null;
      return toSummary(
        record,
        fingerprint === null
          ? null
          : !sameHash(record.fiscalDataSha256, fingerprint),
        current?.issued ?? null,
      );
    });
  }

  async getArchive(id: string): Promise<BillingLibroIvaArchiveDetail> {
    const record = await this.readCurrentEnvironmentArchive(id);
    const snapshots = await this.currentPeriodSnapshots(
      [record],
      record.environment,
    );
    const current = snapshots.get(periodKey(record.year, record.month));
    const fingerprint = current?.fingerprint ?? null;
    let filePresent: boolean | null;
    try {
      filePresent = await storageObjectExists(ARCHIVE_BUCKET, record.storagePath);
    } catch (error) {
      logArchiveFailure(
        "No se pudo comprobar si el archivo histórico sigue en Storage.",
        { archiveId: record.id },
        error,
      );
      filePresent = null;
    }

    return {
      ...toSummary(
        record,
        fingerprint === null
          ? null
          : !sameHash(record.fiscalDataSha256, fingerprint),
        current?.issued ?? null,
      ),
      filePresent,
    };
  }

  async listFilePresence(
    ids: readonly string[],
  ): Promise<Array<{ id: string; filePresent: boolean | null }>> {
    await this.authorizeReader();
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      assertArchiveId(id);
      unique.push(id);
    }

    if (unique.length === 0) {
      return [];
    }

    if (unique.length > PRESENCE_BATCH_LIMIT) {
      throw new BillingLibroIvaArchiveError(
        "La consulta de archivos es demasiado amplia.",
        "VALIDATION_ERROR",
      );
    }

    const settings = await billingFiscalSettingsRepository.getOrCreate();
    const records = await billingLibroIvaArchiveRepository.findByIds(
      unique,
      settings.environment,
    );
    const byId = new Map(records.map((record) => [record.id, record]));
    const folders = new Set<string>();
    for (const record of records) {
      folders.add(splitStoragePath(record.storagePath).folder);
    }

    const listed = await mapWithConcurrency(
      [...folders],
      PRESENCE_LIST_CONCURRENCY,
      async (folder) => {
        try {
          const names = await listStorageFileNames(ARCHIVE_BUCKET, folder);
          return [folder, new Set(names)] as const;
        } catch (error) {
          logArchiveFailure(
            "No se pudo comprobar si los archivos históricos siguen en Storage.",
            { folder },
            error,
          );
          return [folder, null] as const;
        }
      },
    );
    const namesByFolder = new Map(listed);

    return unique.map((id) => {
      const record = byId.get(id);
      if (!record) {
        return { id, filePresent: null };
      }

      const location = splitStoragePath(record.storagePath);
      const names = namesByFolder.get(location.folder);
      if (names == null) {
        return { id, filePresent: null };
      }

      return { id, filePresent: names.has(location.fileName) };
    });
  }

  async downloadArchive(id: string): Promise<BillingLibroIvaArchiveFile> {
    const record = await this.readCurrentEnvironmentArchive(id);

    try {
      const bytes = await downloadFile(ARCHIVE_BUCKET, record.storagePath);
      return {
        bytes,
        filename: downloadFilename(record.fileName, record.format),
        contentType: contentTypeFor(record.format),
      };
    } catch (error) {
      logArchiveFailure(
        "El registro existe pero el archivo histórico no se pudo leer.",
        { archiveId: record.id },
        error,
      );
      throw new BillingLibroIvaArchiveError(
        "El archivo histórico no está disponible.",
        "ARCHIVE_FILE_MISSING",
      );
    }
  }

  private async authorizeReader() {
    const auth = await requirePermission("invoices.read");
    if (!canPreviewBillingSections(auth.profile.email)) {
      throw new AuthForbiddenError();
    }
  }

  private async readCurrentEnvironmentArchive(
    id: string,
  ): Promise<BillingLibroIvaArchiveRecord> {
    await this.authorizeReader();
    assertArchiveId(id);
    const settings = await billingFiscalSettingsRepository.getOrCreate();
    const record = await billingLibroIvaArchiveRepository.findById(id);
    if (!record || record.environment !== settings.environment) {
      throw new BillingLibroIvaArchiveError(
        "No se encontró el libro archivado.",
        "NOT_FOUND",
      );
    }

    return record;
  }

  /**
   * Vuelve a leer el período con libroIvaMonthRange y la misma carga del
   * generador. No arma otro criterio de fechas.
   */
  private async currentPeriodSnapshots(
    records: readonly BillingLibroIvaArchiveRecord[],
    environment: BillingFiscalEnvironment,
  ): Promise<
    Map<string, { fingerprint: string | null; issued: LibroIvaIssuedSummary | null }>
  > {
    const periods = new Map<string, { year: number; month: number }>();
    for (const record of records) {
      periods.set(periodKey(record.year, record.month), {
        year: record.year,
        month: record.month,
      });
    }

    const snapshots = new Map<
      string,
      { fingerprint: string | null; issued: LibroIvaIssuedSummary | null }
    >();
    for (const [key, period] of periods) {
      try {
        const range = libroIvaMonthRange(period.year, period.month);
        const source = await loadLibroIvaSource(range);
        if (source.environment !== environment) {
          snapshots.set(key, { fingerprint: null, issued: null });
          continue;
        }

        snapshots.set(key, {
          fingerprint: fiscalDataSha256(source.environment, source.rows),
          issued: summarizeLibroIvaIssued(source.rows),
        });
      } catch (error) {
        logArchiveFailure(
          "No se pudo comparar el libro archivado con los datos actuales.",
          { period: key },
          error,
        );
        snapshots.set(key, { fingerprint: null, issued: null });
      }
    }

    return snapshots;
  }
}

export const billingLibroIvaArchiveService = new BillingLibroIvaArchiveService();
