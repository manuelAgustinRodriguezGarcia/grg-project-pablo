"use client";

import Link from "next/link";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileDown,
  ICON_STROKE,
  TableProperties,
} from "@/shared/icons";
import { ImportJobStatusBadge } from "@/features/files/components/ImportJobStatusBadge";
import type { UploadedFileListResponse } from "@/features/files/types/uploaded-file.types";
import { formatAdminDateTime } from "@/features/files/utils/format-admin-datetime";
import { formatFileSize } from "@/features/files/utils/format-file-size";
import {
  formatDestinationSummary,
  formatDestinationTypeLabel,
  formatImportMetrics,
} from "@/features/files/utils/format-destination-summary";
import catalogStyles from "@/features/catalog/styles/CatalogNavigator.module.scss";
import styles from "@/features/files/styles/FilesManager.module.scss";

type UploadedFilesListProps = {
  data: UploadedFileListResponse | null;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onViewDetail: (fileId: string) => void;
  onDownload: (fileId: string) => void;
  isActionBusy?: boolean;
  busyFileId?: string | null;
};

function getPaginationRange(pagination: UploadedFileListResponse["pagination"]): {
  from: number;
  to: number;
} {
  if (pagination.total === 0) {
    return { from: 0, to: 0 };
  }

  const from = (pagination.page - 1) * pagination.pageSize + 1;
  const to = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return { from, to };
}

export function UploadedFilesList({
  data,
  isLoading,
  error,
  onPageChange,
  onViewDetail,
  onDownload,
  isActionBusy = false,
  busyFileId = null,
}: UploadedFilesListProps) {
  if (isLoading) {
    return (
      <section
        className={`${catalogStyles.tablePanel} ${catalogStyles.tablePanelLoading}`}
        aria-label="Listado de archivos"
        aria-busy="true"
      >
        <div className={catalogStyles.tableLoading} role="status" aria-live="polite">
          <TableProperties
            className={catalogStyles.tableLoadingIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          <p className={catalogStyles.tableLoadingText}>Cargando archivos</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={catalogStyles.tablePanel} aria-label="Listado de archivos">
        <p className={catalogStyles.tableStateError}>{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className={catalogStyles.tablePanel} aria-label="Listado de archivos">
        <p className={catalogStyles.tableState}>No hay datos de archivos disponibles.</p>
      </section>
    );
  }

  const { from, to } = getPaginationRange(data.pagination);
  const { pagination } = data;

  return (
    <section className={catalogStyles.tablePanel} aria-label="Listado de archivos">
      <div
        className={`${catalogStyles.tableWrap} ${data.items.length === 0 ? catalogStyles.tableWrapEmpty : ""}`}
      >
        {data.items.length === 0 ? (
          <div className={catalogStyles.tableEmpty} role="status">
            <Archive
              className={catalogStyles.tableEmptyIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            <p className={catalogStyles.tableEmptyText}>No hay archivos subidos.</p>
            <Link href="/admin/catalogos" className={styles.emptyCta}>
              Importar desde Catálogos
            </Link>
          </div>
        ) : (
          <>
            <div className={styles.desktopTable}>
              <table className={catalogStyles.productTable}>
                <thead>
                  <tr>
                    <th scope="col">Archivo</th>
                    <th scope="col">Tamaño</th>
                    <th scope="col">Carga</th>
                    <th scope="col" className={styles.hideTablet}>
                      Usuario
                    </th>
                    <th scope="col">Destino</th>
                    <th scope="col">Catálogo / carpeta</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Último proc.</th>
                    <th scope="col">Productos</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const destination = formatDestinationSummary(item.latestJob);
                    const isBusy = isActionBusy && busyFileId === item.id;

                    return (
                      <tr key={item.id}>
                        <td className={styles.fileNameCell}>
                          <span className={styles.fileNamePrimary}>{item.originalName}</span>
                          <span className={styles.fileNameMeta}>
                            {item.extension ? `.${item.extension}` : "Sin extensión"} ·{" "}
                            {formatDestinationTypeLabel(item.destinationType)}
                          </span>
                        </td>
                        <td className={styles.metricCell}>{formatFileSize(item.sizeBytes)}</td>
                        <td>{formatAdminDateTime(item.uploadedAt)}</td>
                        <td className={styles.hideTablet}>{item.uploadedBy.name}</td>
                        <td>{formatDestinationTypeLabel(item.destinationType)}</td>
                        <td className={styles.destinationCell}>
                          <span className={styles.destinationPrimary}>{destination.primary}</span>
                          <span className={styles.destinationSecondary}>
                            {destination.secondary}
                          </span>
                        </td>
                        <td>
                          {item.latestJob ? (
                            <ImportJobStatusBadge status={item.latestJob.status} />
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td>
                          {item.latestJob?.finishedAt
                            ? formatAdminDateTime(item.latestJob.finishedAt)
                            : "—"}
                        </td>
                        <td className={styles.metricCell}>
                          {formatImportMetrics(item.latestJob)}
                        </td>
                        <td className={styles.actionsCell}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => onViewDetail(item.id)}
                            aria-label={`Ver detalle de ${item.originalName}`}
                            disabled={isBusy}
                          >
                            <Eye strokeWidth={ICON_STROKE} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => onDownload(item.id)}
                            aria-label={`Descargar ${item.originalName}`}
                            disabled={isBusy}
                          >
                            <FileDown strokeWidth={ICON_STROKE} aria-hidden />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={styles.cardList}>
              {data.items.map((item) => {
                const destination = formatDestinationSummary(item.latestJob);
                const isBusy = isActionBusy && busyFileId === item.id;

                return (
                  <article key={item.id} className={styles.fileCard}>
                    <div className={styles.fileCardHeader}>
                      <h2 className={styles.fileCardTitle}>{item.originalName}</h2>
                      {item.latestJob ? (
                        <ImportJobStatusBadge status={item.latestJob.status} />
                      ) : null}
                    </div>

                    <dl className={styles.fileCardMeta}>
                      <div className={styles.fileCardMetaItem}>
                        <dt className={styles.fileCardMetaLabel}>Tamaño</dt>
                        <dd className={styles.fileCardMetaValue}>
                          {formatFileSize(item.sizeBytes)}
                        </dd>
                      </div>
                      <div className={styles.fileCardMetaItem}>
                        <dt className={styles.fileCardMetaLabel}>Carga</dt>
                        <dd className={styles.fileCardMetaValue}>
                          {formatAdminDateTime(item.uploadedAt)}
                        </dd>
                      </div>
                      <div className={styles.fileCardMetaItem}>
                        <dt className={styles.fileCardMetaLabel}>Usuario</dt>
                        <dd className={styles.fileCardMetaValue}>{item.uploadedBy.name}</dd>
                      </div>
                      <div className={styles.fileCardMetaItem}>
                        <dt className={styles.fileCardMetaLabel}>Destino</dt>
                        <dd className={styles.fileCardMetaValue}>
                          {formatDestinationTypeLabel(item.destinationType)}
                        </dd>
                      </div>
                    </dl>

                    <div className={styles.fileCardImportBlock}>
                      <p className={styles.fileCardImportTitle}>Última importación</p>
                      <p className={styles.fileCardImportText}>
                        {destination.primary} · {destination.secondary}
                        <br />
                        {formatImportMetrics(item.latestJob)}
                      </p>
                    </div>

                    <div className={styles.fileCardActions}>
                      <button
                        type="button"
                        className={styles.cardActionButton}
                        onClick={() => onViewDetail(item.id)}
                        disabled={isBusy}
                      >
                        <Eye strokeWidth={ICON_STROKE} aria-hidden />
                        Ver detalle
                      </button>
                      <button
                        type="button"
                        className={styles.cardActionButton}
                        onClick={() => onDownload(item.id)}
                        disabled={isBusy}
                      >
                        <FileDown strokeWidth={ICON_STROKE} aria-hidden />
                        Descargar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>

      {data.items.length > 0 ? (
        <footer className={catalogStyles.tableFooter}>
          <p className={catalogStyles.tableSummary}>
            Mostrando {from} a {to} de {pagination.total} archivos
          </p>

          <div className={catalogStyles.tablePagination}>
            <button
              type="button"
              className={catalogStyles.paginationButton}
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft strokeWidth={ICON_STROKE} aria-hidden />
            </button>

            <span className={catalogStyles.paginationLabel}>
              Página {pagination.page} de {Math.max(pagination.totalPages, 1)}
            </span>

            <button
              type="button"
              className={catalogStyles.paginationButton}
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              aria-label="Página siguiente"
            >
              <ChevronRight strokeWidth={ICON_STROKE} aria-hidden />
            </button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
