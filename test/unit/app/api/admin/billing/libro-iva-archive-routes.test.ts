import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForbiddenError } from "@/server/auth/errors";
import { BillingLibroIvaArchiveError } from "@/server/services/billing-libro-iva-archive.errors";
import { billingLibroIvaArchiveService } from "@/server/services/billing-libro-iva-archive.service";
import { GET as listArchives } from "@/app/api/admin/billing/libro-iva/archives/route";
import { GET as listPresence } from "@/app/api/admin/billing/libro-iva/archives/presence/route";
import { GET as getArchive } from "@/app/api/admin/billing/libro-iva/archives/[archiveId]/route";
import { GET as downloadArchive } from "@/app/api/admin/billing/libro-iva/archives/[archiveId]/file/route";

const list = vi.hoisted(() => vi.fn());
const getOne = vi.hoisted(() => vi.fn());
const download = vi.hoisted(() => vi.fn());
const presence = vi.hoisted(() => vi.fn());

vi.mock("@/server/database/prisma", () => ({
  prisma: {},
}));

vi.mock("@/server/services/billing-libro-iva-archive.service", () => ({
  billingLibroIvaArchiveService: {
    listArchives: list,
    getArchive: getOne,
    downloadArchive: download,
    listFilePresence: presence,
  },
}));

const ARCHIVE_ID = "caaaaaaaaaaaaaaaaaaaaaaaaa";

describe("rutas de resúmenes de libros de IVA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista sin incluir la ruta de Storage", async () => {
    list.mockResolvedValue([
      {
        id: ARCHIVE_ID,
        format: "PDF",
        fiscalSourceChanged: false,
      },
    ]);

    const response = await listArchives(
      new Request("http://localhost/api/admin/billing/libro-iva/archives?year=2026&month=10"),
    );

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith({ year: "2026", month: "10" });
    const body = await response.json();
    expect(body).toEqual({
      archives: [
        {
          id: ARCHIVE_ID,
          format: "PDF",
          fiscalSourceChanged: false,
        },
      ],
    });
    expect(body.archives[0]).not.toHaveProperty("storagePath");
  });

  it("responde 403 si el permiso no alcanza", async () => {
    list.mockRejectedValue(new AuthForbiddenError());

    const response = await listArchives(
      new Request("http://localhost/api/admin/billing/libro-iva/archives"),
    );

    expect(response.status).toBe(403);
  });

  it("responde 400 si el identificador no es válido", async () => {
    getOne.mockRejectedValue(
      new BillingLibroIvaArchiveError(
        "El identificador del libro archivado no es válido.",
        "VALIDATION_ERROR",
      ),
    );

    const response = await getArchive(
      new Request("http://localhost/api/admin/billing/libro-iva/archives/../secret"),
      { params: Promise.resolve({ archiveId: "../secret" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("descarga los bytes históricos y no usa una ruta pedida por query", async () => {
    const bytes = Buffer.from([8, 6, 7, 5, 3, 0, 9]);
    download.mockResolvedValue({
      bytes,
      filename: "Libro-IVA-2026-10.pdf",
      contentType: "application/pdf",
    });

    const response = await downloadArchive(
      new Request(
        "http://localhost/api/admin/billing/libro-iva/archives/id/file?path=libros-iva/OTHER/secret.pdf",
      ),
      { params: Promise.resolve({ archiveId: ARCHIVE_ID }) },
    );
    const body = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(body.equals(bytes)).toBe(true);
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(response.headers.get("Content-Disposition")).toContain(
      "Libro-IVA-2026-10.pdf",
    );
    expect(download).toHaveBeenCalledWith(ARCHIVE_ID);
    expect(billingLibroIvaArchiveService.downloadArchive).toHaveBeenCalledTimes(1);
  });

  it("responde 404 si el archivo histórico no está", async () => {
    download.mockRejectedValue(
      new BillingLibroIvaArchiveError(
        "El archivo histórico no está disponible.",
        "ARCHIVE_FILE_MISSING",
      ),
    );

    const response = await downloadArchive(
      new Request("http://localhost/api/admin/billing/libro-iva/archives/id/file"),
      { params: Promise.resolve({ archiveId: ARCHIVE_ID }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: "ARCHIVE_FILE_MISSING",
    });
  });

  it("consulta la presencia por lote sin descargar el archivo", async () => {
    presence.mockResolvedValue([{ id: ARCHIVE_ID, filePresent: false }]);

    const response = await listPresence(
      new Request(
        `http://localhost/api/admin/billing/libro-iva/archives/presence?id=${ARCHIVE_ID}`,
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      files: [{ id: ARCHIVE_ID, filePresent: false }],
    });
    expect(presence).toHaveBeenCalledWith([ARCHIVE_ID]);
    expect(download).not.toHaveBeenCalled();
    expect(getOne).not.toHaveBeenCalled();
  });
});
