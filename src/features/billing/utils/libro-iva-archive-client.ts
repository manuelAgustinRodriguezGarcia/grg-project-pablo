import type {
  LibroIvaArchiveDetail,
  LibroIvaArchivePresenceFile,
  LibroIvaArchivePresenceResponse,
  LibroIvaArchiveSummary,
} from "@/features/billing/types/libro-iva-archive.types";
import { filenameFromContentDisposition } from "@/features/billing/utils/libro-iva-resumenes";
import { printPdfBlob } from "@/features/billing/utils/print-document";

const ARCHIVES_PATH = "/api/admin/billing/libro-iva/archives";
const PRESENCE_BATCH = 48;

export class LibroIvaArchiveRequestError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "LibroIvaArchiveRequestError";
    this.status = status;
    this.code = code;
  }
}

type ErrorPayload = {
  error?: string;
  code?: string;
};

export function libroIvaArchiveErrorMessage(
  status: number,
  payload: ErrorPayload | null,
  fallback: string,
): string {
  if (status === 401) {
    return "La sesión venció. Volvé a iniciar sesión.";
  }

  if (status === 403) {
    return "No tenés permiso para consultar estos resúmenes.";
  }

  if (payload?.code === "ARCHIVE_FILE_MISSING") {
    return payload.error || "El archivo histórico no está disponible.";
  }

  return payload?.error || fallback;
}

function archivePath(id: string): string {
  return `${ARCHIVES_PATH}/${encodeURIComponent(id)}`;
}

async function readErrorPayload(response: Response): Promise<ErrorPayload | null> {
  return (await response.json().catch(() => null)) as ErrorPayload | null;
}

async function requestArchive(
  url: string,
  fallback: string,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { credentials: "include", cache: "no-store" });
  } catch {
    throw new LibroIvaArchiveRequestError(
      "No se pudo conectar con el servidor.",
      0,
      null,
    );
  }

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw new LibroIvaArchiveRequestError(
      libroIvaArchiveErrorMessage(response.status, payload, fallback),
      response.status,
      payload?.code ?? null,
    );
  }

  return response;
}

export async function fetchLibroIvaArchives(): Promise<LibroIvaArchiveSummary[]> {
  const response = await requestArchive(
    ARCHIVES_PATH,
    "No se pudieron cargar los resúmenes.",
  );
  const payload = (await response.json().catch(() => null)) as {
    archives?: unknown;
  } | null;

  if (!payload || !Array.isArray(payload.archives)) {
    throw new LibroIvaArchiveRequestError(
      "La respuesta de resúmenes no es válida.",
      response.status,
      null,
    );
  }

  return payload.archives as LibroIvaArchiveSummary[];
}

export async function fetchLibroIvaArchiveDetail(
  id: string,
): Promise<LibroIvaArchiveDetail> {
  const response = await requestArchive(
    archivePath(id),
    "No se pudo consultar el archivo.",
  );
  const payload = (await response.json().catch(() => null)) as {
    archive?: LibroIvaArchiveDetail;
  } | null;

  if (!payload?.archive) {
    throw new LibroIvaArchiveRequestError(
      "La respuesta del archivo no es válida.",
      response.status,
      null,
    );
  }

  return payload.archive;
}

export async function fetchLibroIvaArchivePresence(
  ids: readonly string[],
): Promise<LibroIvaArchivePresenceFile[]> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
  }

  if (unique.length === 0) {
    return [];
  }

  const files: LibroIvaArchivePresenceFile[] = [];
  for (let index = 0; index < unique.length; index += PRESENCE_BATCH) {
    const batch = unique.slice(index, index + PRESENCE_BATCH);
    const params = new URLSearchParams();
    for (const id of batch) {
      params.append("id", id);
    }

    const response = await requestArchive(
      `${ARCHIVES_PATH}/presence?${params.toString()}`,
      "No se pudo comprobar el archivo.",
    );
    const payload = (await response.json().catch(() => null)) as
      | LibroIvaArchivePresenceResponse
      | null;
    if (!payload || !Array.isArray(payload.files)) {
      throw new LibroIvaArchiveRequestError(
        "La respuesta de los archivos no es válida.",
        response.status,
        null,
      );
    }

    files.push(...payload.files);
  }

  return files;
}

function saveBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

async function fetchArchiveFile(
  archive: { id: string },
  fallback: string,
): Promise<Response> {
  return requestArchive(`${archivePath(archive.id)}/file`, fallback);
}

export async function downloadLibroIvaArchiveFile(archive: {
  id: string;
  fileName: string;
}): Promise<void> {
  const response = await fetchArchiveFile(archive, "No se pudo descargar el archivo.");
  const blob = await response.blob();
  const filename = filenameFromContentDisposition(
    response.headers.get("Content-Disposition"),
    archive.fileName,
  );
  saveBlob(blob, filename);
}

export async function printLibroIvaArchiveFile(archive: { id: string }): Promise<void> {
  const response = await fetchArchiveFile(archive, "No se pudo imprimir el archivo.");
  await printPdfBlob(await response.blob());
}
