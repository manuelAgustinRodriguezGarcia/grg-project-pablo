"use client";

import { useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import { useReportAdminSectionReady } from "@/features/admin/components/AdminSectionTransition";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { getBillingFiscalSettingsAction } from "@/features/billing/actions/billing-fiscal-settings.actions";
import {
  useLibroIvaArchivePresenceQuery,
  useLibroIvaArchivesQuery,
} from "@/features/billing/hooks/useLibroIvaArchivesQuery";
import type {
  LibroIvaArchiveFormat,
  LibroIvaArchiveSummary,
} from "@/features/billing/types/libro-iva-archive.types";
import {
  LibroIvaArchiveRequestError,
  downloadLibroIvaArchiveFile,
  printLibroIvaArchiveFile,
} from "@/features/billing/utils/libro-iva-archive-client";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import {
  LIBRO_IVA_ARCHIVE_STATUS_LABELS,
  LIBRO_IVA_FISCAL_CHANGED_WARNING,
  LIBRO_IVA_MONTH_FILTER_OPTIONS,
  LIBRO_IVA_RESUMENES_EMPTY_HINT,
  defaultLibroIvaArchiveYear,
  filterLibroIvaArchives,
  groupLibroIvaArchives,
  libroIvaArchiveYearOptions,
  libroIvaMonthName,
  libroIvaResumenesEmptyMessage,
  parseLibroIvaMonthFilter,
  resolveLibroIvaArchiveStatus,
  type LibroIvaArchiveGroup,
  type LibroIvaArchiveStatusKind,
  type LibroIvaMonthFilter,
} from "@/features/billing/utils/libro-iva-resumenes";
import { CustomSelect } from "@/shared/components/CustomSelect";
import {
  Archive,
  FileSpreadsheet,
  FileText,
  ICON_STROKE,
  Printer,
} from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";
import resumenes from "@/features/billing/styles/LibroIvaResumenes.module.scss";

type LibroIvaResumenesManagerProps = {
  initialEnvironment: BillingFiscalEnvironment;
};

type LibroIvaArchiveYearSection = {
  year: number;
  months: LibroIvaArchiveGroup[];
};

function groupLibroIvaArchivesByYear(
  groups: readonly LibroIvaArchiveGroup[],
): LibroIvaArchiveYearSection[] {
  const sections: LibroIvaArchiveYearSection[] = [];

  for (const group of groups) {
    const current = sections[sections.length - 1];
    if (!current || current.year !== group.year) {
      sections.push({ year: group.year, months: [group] });
      continue;
    }

    current.months.push(group);
  }

  return sections;
}

function visibleArchiveStatus(
  kind: LibroIvaArchiveStatusKind,
): "fiscal-changed" | "missing" | null {
  switch (kind) {
    case "archived":
    case "unverified":
      return null;
    case "fiscal-changed":
    case "missing":
      return kind;
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}

function statusBadgeClass(kind: "fiscal-changed" | "missing"): string {
  switch (kind) {
    case "fiscal-changed":
      return styles.statusBadgeDebt;
    case "missing":
      return styles.statusBadgeInactive;
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}

const ISSUED_ROWS = [
  { key: "facturasA", label: "Facturas A" },
  { key: "facturasB", label: "Facturas B" },
  { key: "notasCredito", label: "Notas de crédito" },
  { key: "notasDebito", label: "Notas de débito" },
] as const;

function periodIssued(files: readonly LibroIvaArchiveSummary[]) {
  for (const file of files) {
    if (file.issued) {
      return file.issued;
    }
  }

  return null;
}

function issuedQuantityLabel(
  key: (typeof ISSUED_ROWS)[number]["key"],
  count: number,
): string {
  switch (key) {
    case "facturasA":
    case "facturasB":
      return `${count} ${count === 1 ? "FACTURA" : "FACTURAS"}`;
    case "notasCredito":
    case "notasDebito":
      return `${count} ${count === 1 ? "NOTA" : "NOTAS"}`;
    default: {
      const unexpected: never = key;
      return unexpected;
    }
  }
}

function downloadActionLabel(format: LibroIvaArchiveFormat): string {
  switch (format) {
    case "PDF":
      return "Descargar PDF";
    case "XLSX":
      return "Descargar Excel";
    default: {
      const unexpected: never = format;
      return unexpected;
    }
  }
}

function DownloadGlyph({ format }: { format: LibroIvaArchiveFormat }) {
  switch (format) {
    case "PDF":
      return <FileText strokeWidth={ICON_STROKE} aria-hidden />;
    case "XLSX":
      return <FileSpreadsheet strokeWidth={ICON_STROKE} aria-hidden />;
    default: {
      const unexpected: never = format;
      return unexpected;
    }
  }
}

export function LibroIvaResumenesManager({
  initialEnvironment,
}: LibroIvaResumenesManagerProps) {
  useReportAdminSectionReady(true);

  const settingsQuery = useQuery({
    queryKey: adminQueryKeys.billingFiscalSettings(),
    queryFn: async () => {
      const result = await getBillingFiscalSettingsAction();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data.environment;
    },
    staleTime: 30_000,
  });

  const environment = settingsQuery.data ?? initialEnvironment;
  const [environmentSeen, setEnvironmentSeen] = useState(initialEnvironment);
  const [yearChoice, setYearChoice] = useState<number | null>(null);
  const [monthChoice, setMonthChoice] = useState<LibroIvaMonthFilter>("all");
  const [missingIds, setMissingIds] = useState<ReadonlySet<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<ReadonlySet<string>>(new Set());
  const [printingIds, setPrintingIds] = useState<ReadonlySet<string>>(new Set());
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const downloadsInFlight = useRef(new Set<string>());
  const printsInFlight = useRef(new Set<string>());

  const environmentChanged = environment !== environmentSeen;
  if (environmentChanged) {
    setEnvironmentSeen(environment);
    setYearChoice(null);
    setMonthChoice("all");
    setMissingIds(new Set());
    setDownloadError(null);
    setPrintingIds(new Set());
  }

  const activeMonth = environmentChanged ? "all" : monthChoice;
  const activeYearChoice = environmentChanged ? null : yearChoice;
  const activeMissing = environmentChanged ? new Set<string>() : missingIds;

  const archivesQuery = useLibroIvaArchivesQuery(environment);
  const archives = archivesQuery.data ?? [];
  const selectedYear = activeYearChoice ?? defaultLibroIvaArchiveYear(archives);
  const filtered = filterLibroIvaArchives(archives, selectedYear, activeMonth);
  const presenceIds = archives
    .filter((archive) => archive.year === selectedYear)
    .map((archive) => archive.id);
  const presenceQuery = useLibroIvaArchivePresenceQuery(environment, presenceIds);

  const yearOptions = libroIvaArchiveYearOptions(archives, selectedYear);
  const groups = groupLibroIvaArchives(filtered);
  const yearHasArchives = archives.some((archive) => archive.year === selectedYear);

  function filePresence(archiveId: string): boolean | null | undefined {
    if (activeMissing.has(archiveId)) {
      return false;
    }
    if (presenceQuery.isPending) {
      return undefined;
    }
    if (presenceQuery.isError) {
      return null;
    }
    const present = presenceQuery.data?.[archiveId];
    return present === undefined ? null : present;
  }

  async function downloadArchive(archive: LibroIvaArchiveSummary) {
    if (downloadsInFlight.current.has(archive.id) || activeMissing.has(archive.id)) {
      return;
    }

    downloadsInFlight.current.add(archive.id);
    setDownloadingIds((current) => new Set(current).add(archive.id));
    setDownloadError(null);

    try {
      await downloadLibroIvaArchiveFile(archive);
    } catch (error) {
      if (
        error instanceof LibroIvaArchiveRequestError &&
        error.code === "ARCHIVE_FILE_MISSING"
      ) {
        setMissingIds((current) => new Set(current).add(archive.id));
      }
      setDownloadError(
        error instanceof Error ? error.message : "No se pudo descargar el archivo.",
      );
    } finally {
      downloadsInFlight.current.delete(archive.id);
      setDownloadingIds((current) => {
        const next = new Set(current);
        next.delete(archive.id);
        return next;
      });
    }
  }

  async function printArchive(archive: LibroIvaArchiveSummary) {
    if (printsInFlight.current.has(archive.id) || activeMissing.has(archive.id)) {
      return;
    }

    printsInFlight.current.add(archive.id);
    setPrintingIds((current) => new Set(current).add(archive.id));
    setDownloadError(null);

    try {
      await printLibroIvaArchiveFile(archive);
    } catch (error) {
      if (
        error instanceof LibroIvaArchiveRequestError &&
        error.code === "ARCHIVE_FILE_MISSING"
      ) {
        setMissingIds((current) => new Set(current).add(archive.id));
      }
      setDownloadError(
        error instanceof Error ? error.message : "No se pudo imprimir el archivo.",
      );
    } finally {
      printsInFlight.current.delete(archive.id);
      setPrintingIds((current) => {
        const next = new Set(current);
        next.delete(archive.id);
        return next;
      });
    }
  }

  let results: ReactNode;
  let centerResults = false;
  if (archivesQuery.isPending || (archivesQuery.isFetching && archives.length === 0)) {
    results = (
      <div className={resumenes.skeletonList} role="status" aria-label="Cargando resúmenes">
        <span className={resumenes.srOnly}>Cargando resúmenes…</span>
        <div className={resumenes.yearBlock} aria-hidden>
          <div className={resumenes.yearTitle}>
            <span className={`${resumenes.skeletonBar} ${resumenes.skeletonYear}`} />
            <span className={resumenes.yearRule} />
          </div>
          <div className={resumenes.yearBooks}>
            {[0, 1, 2].map((row) => (
              <article key={row} className={resumenes.bookCard}>
                <div className={resumenes.bookHeader}>
                  <div className={resumenes.bookIdentity}>
                    <span className={`${resumenes.skeletonBar} ${resumenes.skeletonPill}`} />
                    <span className={`${resumenes.skeletonBar} ${resumenes.skeletonTitle}`} />
                  </div>
                  <ul className={resumenes.downloads}>
                    <li className={resumenes.downloadItem}>
                      <span className={`${resumenes.skeletonBar} ${resumenes.skeletonActionWide}`} />
                    </li>
                    <li className={resumenes.downloadItem}>
                      <span className={`${resumenes.skeletonBar} ${resumenes.skeletonActionWide}`} />
                    </li>
                    <li className={resumenes.downloadItem}>
                      <span className={`${resumenes.skeletonBar} ${resumenes.skeletonActionShort}`} />
                    </li>
                  </ul>
                </div>
                <ul className={resumenes.issuedGrid}>
                  {ISSUED_ROWS.map((issuedRow) => (
                    <li key={issuedRow.key} className={resumenes.issuedItem}>
                      <span className={`${resumenes.skeletonBar} ${resumenes.skeletonIssuedLabel}`} />
                      <span className={`${resumenes.skeletonBar} ${resumenes.skeletonIssuedAmount}`} />
                      <span className={`${resumenes.skeletonBar} ${resumenes.skeletonIssuedQuantity}`} />
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    );
  } else if (archivesQuery.isError) {
    const message =
      archivesQuery.error instanceof Error
        ? archivesQuery.error.message
        : "No se pudieron cargar los resúmenes.";
    results = (
      <div className={styles.tableEmpty}>
        <p className={styles.inlineError} role="alert">
          {message}
        </p>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            void archivesQuery.refetch();
          }}
        >
          Reintentar
        </button>
      </div>
    );
  } else if (groups.length === 0) {
    centerResults = true;
    results = (
      <div className={styles.tableEmpty} role="status">
        <Archive className={styles.tableEmptyIcon} strokeWidth={ICON_STROKE} aria-hidden />
        <p className={styles.tableEmptyText}>
          {libroIvaResumenesEmptyMessage(selectedYear, activeMonth, yearHasArchives)}
        </p>
        {activeMonth === "all" || !yearHasArchives ? (
          <p className={`${styles.sectionHint} ${resumenes.emptyHint}`}>
            {LIBRO_IVA_RESUMENES_EMPTY_HINT}
          </p>
        ) : null}
      </div>
    );
  } else {
    results = (
      <ul className={resumenes.list} aria-label="Libros archivados">
        {groupLibroIvaArchivesByYear(groups).map((section) => (
          <li key={section.year} className={resumenes.yearBlock}>
            <h3 className={resumenes.yearTitle}>
              <span>{section.year}</span>
              <span className={resumenes.yearRule} aria-hidden />
            </h3>
            <ul className={resumenes.yearBooks}>
              {section.months.map((group) => {
                const issued = periodIssued(group.files);

                const pdfArchive = group.files.find((archive) => archive.format === "PDF") ?? null;
                const pdfMissing = pdfArchive
                  ? resolveLibroIvaArchiveStatus({
                      fiscalSourceChanged: pdfArchive.fiscalSourceChanged,
                      filePresent: filePresence(pdfArchive.id),
                      markedMissing: activeMissing.has(pdfArchive.id),
                    }) === "missing"
                  : false;
                const printingPdf = pdfArchive ? printingIds.has(pdfArchive.id) : false;

                return (
                <li key={`${group.year}-${group.month}`} className={resumenes.month}>
                  <article className={resumenes.bookCard} aria-label={group.heading}>
              <div className={resumenes.bookHeader}>
              <div className={resumenes.bookIdentity}>
                <span className={resumenes.monthPill}>
                  {libroIvaMonthName(group.month).toLocaleUpperCase("es-AR")}
                </span>
                <p className={resumenes.fileTitle}>Libro de IVA</p>
              </div>
              <ul className={resumenes.downloads} aria-label={group.heading}>
                {group.files.map((archive) => {
                  const status = resolveLibroIvaArchiveStatus({
                    fiscalSourceChanged: archive.fiscalSourceChanged,
                    filePresent: filePresence(archive.id),
                    markedMissing: activeMissing.has(archive.id),
                  });
                  const visibleStatus = visibleArchiveStatus(status);
                  const busy = downloadingIds.has(archive.id);
                  const unavailable = status === "missing";
                  const label = downloadActionLabel(archive.format);

                  return (
                    <li key={archive.id} className={resumenes.downloadItem}>
                      {visibleStatus ? (
                        <span className={`${styles.statusBadge} ${statusBadgeClass(visibleStatus)}`}>
                          {LIBRO_IVA_ARCHIVE_STATUS_LABELS[visibleStatus]}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className={resumenes.downloadButton}
                        disabled={unavailable || busy}
                        onClick={() => {
                          void downloadArchive(archive);
                        }}
                      >
                        <DownloadGlyph format={archive.format} />
                        {busy ? "Descargando…" : label}
                      </button>
                    </li>
                  );
                })}
                {pdfArchive ? (
                  <li className={resumenes.downloadItem}>
                    <button
                      type="button"
                          className={resumenes.downloadButton}
                          disabled={printingPdf || pdfMissing}
                          onClick={() => {
                            void printArchive(pdfArchive);
                          }}
                        >
                          <Printer strokeWidth={ICON_STROKE} aria-hidden />
                          {printingPdf ? "Abriendo…" : "Imprimir"}
                    </button>
                  </li>
                ) : null}
              </ul>
              </div>
              {issued ? (
                <ul className={resumenes.issuedGrid} aria-label={`Resumen de ${group.heading}`}>
                  {ISSUED_ROWS.map((row) => {
                    const activity = issued[row.key];
                    return (
                      <li key={row.key} className={resumenes.issuedItem}>
                        <span className={resumenes.issuedLabel}>{row.label}</span>
                        <span className={resumenes.issuedAmount}>
                          {formatArsExact(activity.total)}
                        </span>
                        <span className={resumenes.issuedQuantity}>
                          {issuedQuantityLabel(row.key, activity.count)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className={resumenes.fileMeta}>Resumen no disponible.</p>
              )}
              {group.files.some((archive) => archive.fiscalSourceChanged) ? (
                <p className={resumenes.warning}>{LIBRO_IVA_FISCAL_CHANGED_WARNING}</p>
              ) : null}
            </article>
                </li>
              );
              })}
            </ul>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.body}>
        <header className={styles.sectionIntro}>
          <div className={resumenes.filtersBlock}>
            <h2 className={resumenes.filterLabel}>FILTRAR ENTRE LIBROS</h2>
            <div className={styles.filtersRow}>
              <div className={styles.filterSelect}>
                <CustomSelect
                  ariaLabel="Año"
                  value={String(selectedYear)}
                  options={yearOptions.map((year) => ({
                    value: String(year),
                    label: String(year),
                  }))}
                  onChange={(value) => {
                    const year = Number(value);
                    if (Number.isInteger(year)) {
                      setYearChoice(year);
                    }
                  }}
                />
              </div>
              <div className={styles.filterSelectWide}>
                <CustomSelect
                  ariaLabel="Mes"
                  value={activeMonth === "all" ? "all" : String(activeMonth)}
                  options={LIBRO_IVA_MONTH_FILTER_OPTIONS}
                  onChange={(value) => setMonthChoice(parseLibroIvaMonthFilter(value))}
                />
              </div>
            </div>
          </div>
        </header>

        {downloadError ? (
          <p className={styles.formErrorPill} role="alert">
            {downloadError}
          </p>
        ) : null}

        <div
          className={`${resumenes.results} ${
            centerResults ? resumenes.resultsCentered : ""
          }`}
        >
          {results}
        </div>
      </div>
    </section>
  );
}
