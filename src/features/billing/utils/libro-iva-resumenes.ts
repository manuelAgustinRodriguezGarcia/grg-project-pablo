import type { LibroIvaArchiveFormat, LibroIvaArchiveSummary } from "@/features/billing/types/libro-iva-archive.types";

export const LIBRO_IVA_RESUMENES_TITLE = "Libros de IVA";

export const LIBRO_IVA_RESUMENES_EMPTY_HINT =
  "Los documentos se guardan al descargar libros mensuales de períodos ya finalizados.";

export const LIBRO_IVA_FISCAL_CHANGED_WARNING =
  "Los datos de este período cambiaron desde que se archivó el documento.";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export const LIBRO_IVA_MONTH_FILTER_OPTIONS = [
  { value: "all", label: "Todos los meses" },
  ...MONTH_NAMES.map((label, index) => ({
    value: String(index + 1),
    label,
  })),
];

export type LibroIvaMonthFilter = number | "all";

export type LibroIvaArchiveStatusKind =
  | "archived"
  | "fiscal-changed"
  | "missing"
  | "unverified";

export const LIBRO_IVA_ARCHIVE_STATUS_LABELS = {
  archived: "Archivado",
  "fiscal-changed": "Datos modificados",
  missing: "Archivo no disponible",
  unverified: "No verificado",
} as const satisfies Record<LibroIvaArchiveStatusKind, string>;

export type LibroIvaArchiveGroup = {
  year: number;
  month: number;
  heading: string;
  files: LibroIvaArchiveSummary[];
};

export function libroIvaMonthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "Mes inválido";
}

export function libroIvaResumenesEmptyMessage(
  year: number,
  month: LibroIvaMonthFilter,
  yearHasArchives: boolean,
): string {
  const period =
    month === "all" ? String(year) : `${libroIvaMonthName(month)} de ${year}`;

  if (month !== "all" && yearHasArchives) {
    return `No hay Libros de IVA archivados para ${period}.`;
  }

  return `Todavía no hay Libros de IVA archivados para ${period}.`;
}

export function libroIvaPeriodHeading(year: number, month: number): string {
  return `${libroIvaMonthName(month).toLocaleUpperCase("es-AR")} ${year}`;
}

export function libroIvaArchiveDocumentLabel(format: LibroIvaArchiveFormat): string {
  switch (format) {
    case "PDF":
      return "Libro de IVA — PDF";
    case "XLSX":
      return "Libro de IVA — Excel";
    default: {
      const unexpected: never = format;
      return unexpected;
    }
  }
}

export function libroIvaArchiveFormatLabel(format: LibroIvaArchiveFormat): string {
  switch (format) {
    case "PDF":
      return "PDF";
    case "XLSX":
      return "Excel";
    default: {
      const unexpected: never = format;
      return unexpected;
    }
  }
}

export function parseLibroIvaMonthFilter(value: string): LibroIvaMonthFilter {
  if (value === "all") {
    return "all";
  }

  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return "all";
  }

  return month;
}

export function defaultLibroIvaArchiveYear(
  archives: readonly { year: number }[],
  now = new Date(),
): number {
  const latest = archives.reduce((max, archive) => Math.max(max, archive.year), 0);
  return latest > 0 ? latest : now.getFullYear();
}

export function libroIvaArchiveYearOptions(
  archives: readonly { year: number }[],
  selectedYear: number,
  now = new Date(),
): number[] {
  const years = new Set<number>([now.getFullYear(), selectedYear]);
  for (const archive of archives) {
    years.add(archive.year);
  }

  return [...years].sort((left, right) => right - left);
}

function formatRank(format: LibroIvaArchiveFormat): number {
  switch (format) {
    case "PDF":
      return 0;
    case "XLSX":
      return 1;
    default: {
      const unexpected: never = format;
      return unexpected;
    }
  }
}

export function filterLibroIvaArchives(
  archives: readonly LibroIvaArchiveSummary[],
  year: number,
  month: LibroIvaMonthFilter,
): LibroIvaArchiveSummary[] {
  return archives
    .filter(
      (archive) =>
        archive.year === year && (month === "all" || archive.month === month),
    )
    .sort(
      (left, right) =>
        right.year - left.year ||
        right.month - left.month ||
        formatRank(left.format) - formatRank(right.format),
    );
}

export function groupLibroIvaArchives(
  archives: readonly LibroIvaArchiveSummary[],
): LibroIvaArchiveGroup[] {
  const groups: LibroIvaArchiveGroup[] = [];

  for (const archive of archives) {
    const current = groups[groups.length - 1];
    if (
      !current ||
      current.year !== archive.year ||
      current.month !== archive.month
    ) {
      groups.push({
        year: archive.year,
        month: archive.month,
        heading: libroIvaPeriodHeading(archive.year, archive.month),
        files: [archive],
      });
      continue;
    }

    current.files.push(archive);
  }

  return groups;
}

export function resolveLibroIvaArchiveStatus(input: {
  fiscalSourceChanged: boolean | null;
  filePresent?: boolean | null;
  markedMissing?: boolean;
}): LibroIvaArchiveStatusKind {
  if (input.markedMissing || input.filePresent === false) {
    return "missing";
  }

  if (input.filePresent !== true) {
    return "unverified";
  }

  if (input.fiscalSourceChanged === true) {
    return "fiscal-changed";
  }

  if (input.fiscalSourceChanged !== false) {
    return "unverified";
  }

  return "archived";
}

export function formatArchiveSize(bytes: number): string | null {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return null;
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatArchiveDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function filenameFromContentDisposition(
  header: string | null,
  fallback: string,
): string {
  if (!header) {
    return fallback;
  }

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      return fallback;
    }
  }

  const plain = /filename="([^"]+)"/i.exec(header);
  return plain?.[1] || fallback;
}
