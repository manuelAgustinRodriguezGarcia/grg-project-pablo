"use client";

import { useRef } from "react";
import { AdminTableSkeleton } from "@/features/admin/components/AdminTableSkeleton";
import { useTableHeaderScrollProgress } from "@/shared/hooks/useTableHeaderScrollProgress";
import Link from "next/link";
import { useIsDesktopLayout } from "@/shared/hooks/useIsDesktopLayout";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileDown,
  ICON_STROKE,
  Trash2,
} from "@/shared/icons";
import { ImportJobStatusBadge } from "@/features/files/components/ImportJobStatusBadge";
import type { UploadedFileListItem, UploadedFileListResponse } from "@/features/files/types/uploaded-file.types";
import { formatAdminDateTime } from "@/features/files/utils/format-admin-datetime";
import { formatFileSize } from "@/features/files/utils/format-file-size";
import {
  formatDestinationSummary,
  formatDestinationTypeLabel,
  formatImportMetrics,
} from "@/features/files/utils/format-destination-summary";
import styles from "@/features/files/styles/FilesManager.module.scss";

type UploadedFilesListProps = {
  data: UploadedFileListResponse | null;
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  onPageChange: (page: number) => void;
  onViewDetail: (fileId: string) => void;
  onDownload: (fileId: string) => void;
  onDelete: (item: UploadedFileListItem) => void;
  isActionBusy?: boolean;
  busyFileId?: string | null;
};

function catalogHref(catalogId: string, folderId?: string): string {
  const params = new URLSearchParams({ catalog: catalogId });
  if (folderId) {
    params.set("folder", folderId);
  }
  return `/admin/catalogos?${params.toString()}`;
}

function priceListHref(listId: string): string {
  return `/admin/precios?list=${encodeURIComponent(listId)}`;
}

function DestinationCell({
  latestJob,
}: {
  latestJob: UploadedFileListItem["latestJob"];
}) {
  const destination = formatDestinationSummary(latestJob);

  if (!latestJob) {
    return (
      <td className={styles.destinationCell}>
        <span className={styles.destinationPrimary}>{destination.primary}</span>
        <span className={styles.destinationSecondary}>{destination.secondary}</span>
      </td>
    );
  }

  if (latestJob.destinationType === "PRICE_LIST") {
    const list = latestJob.priceList;

    return (
      <td className={styles.destinationCell}>
        {list ? (
          <Link
            href={priceListHref(list.id)}
            className={`${styles.destinationPrimary} ${styles.destinationLink}`}
          >
            {list.name}
          </Link>
        ) : (
          <span className={styles.destinationPrimary}>{destination.primary}</span>
        )}
        <span className={styles.destinationSecondary}>{destination.secondary}</span>
      </td>
    );
  }

  const catalog = latestJob.catalog;
  const folder = latestJob.folder;

  return (
    <td className={styles.destinationCell}>
      {catalog ? (
        <Link
          href={catalogHref(catalog.id)}
          className={`${styles.destinationPrimary} ${styles.destinationLink}`}
        >
          {catalog.name}
        </Link>
      ) : (
        <span className={styles.destinationPrimary}>{destination.primary}</span>
      )}
      {folder && catalog ? (
        <span className={styles.destinationSecondary}>
          Carpeta:{" "}
          <Link
            href={catalogHref(catalog.id, folder.id)}
            className={styles.destinationLink}
          >
            {folder.name}
          </Link>
        </span>
      ) : (
        <span className={styles.destinationSecondary}>{destination.secondary}</span>
      )}
    </td>
  );
}

function DestinationInline({
  latestJob,
}: {
  latestJob: UploadedFileListItem["latestJob"];
}) {
  const destination = formatDestinationSummary(latestJob);

  if (!latestJob) {
    return (
      <>
        {destination.primary} · {destination.secondary}
      </>
    );
  }

  if (latestJob.destinationType === "PRICE_LIST") {
    const list = latestJob.priceList;

    return (
      <>
        {list ? (
          <Link href={priceListHref(list.id)} className={styles.destinationLink}>
            {list.name}
          </Link>
        ) : (
          destination.primary
        )}{" "}
        · {destination.secondary}
      </>
    );
  }

  const catalog = latestJob.catalog;
  const folder = latestJob.folder;

  return (
    <>
      {catalog ? (
        <Link href={catalogHref(catalog.id)} className={styles.destinationLink}>
          {catalog.name}
        </Link>
      ) : (
        destination.primary
      )}
      {" · "}
      {folder && catalog ? (
        <>
          Carpeta:{" "}
          <Link
            href={catalogHref(catalog.id, folder.id)}
            className={styles.destinationLink}
          >
            {folder.name}
          </Link>
        </>
      ) : (
        destination.secondary
      )}
    </>
  );
}

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
  isAdmin,
  onPageChange,
  onViewDetail,
  onDownload,
  onDelete,
  isActionBusy = false,
  busyFileId = null,
}: UploadedFilesListProps) {
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const isDesktopLayout = useIsDesktopLayout();
  useTableHeaderScrollProgress(
    tableWrapRef,
    data ? `${data.items.length}-${data.pagination.page}` : null,
  );

  if (isLoading) {
    return (
      <section
        className={styles.tablePanel}
        aria-label="Listado de archivos"
        aria-busy="true"
      >
        <div className={`${styles.tableWrap} ${styles.tableWrapLoading}`}>
          <AdminTableSkeleton
            variant="files"
            label="Cargando archivos"
            rowCount={18}
            fillHeight
          />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de archivos">
        <p className={styles.tableStateError}>{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de archivos">
        <p className={styles.tableState}>No hay datos de archivos disponibles.</p>
      </section>
    );
  }

  const { from, to } = getPaginationRange(data.pagination);
  const { pagination } = data;

  return (
    <section className={styles.tablePanel} aria-label="Listado de archivos">
      <div
        ref={tableWrapRef}
        className={`${styles.tableWrap} ${data.items.length === 0 ? styles.tableWrapEmpty : ""}`}
      >
        {data.items.length === 0 ? (
          <div className={styles.tableEmpty} role="status">
            <Archive
              className={styles.tableEmptyIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            <p className={styles.tableEmptyText}>No hay archivos subidos.</p>
            {isAdmin ? (
              <Link href="/admin/catalogos" className={styles.emptyCta}>
                Importar desde Catálogos
              </Link>
            ) : null}
          </div>
        ) : (
          isDesktopLayout ? (
            <div className={styles.desktopTable}>
              <table className={styles.filesTable}>
                <thead>
                  <tr>
                    <th scope="col">Archivo</th>
                    <th scope="col">Fecha</th>
                    <th scope="col" className={styles.hideTablet}>
                      Usuario
                    </th>
                    <th scope="col">Destino</th>
                    <th scope="col">Catálogo / carpeta</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Productos</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const isBusy = isActionBusy && busyFileId === item.id;

                    return (
                      <tr key={item.id}>
                        <td className={styles.fileNameCell}>
                          <span className={styles.fileNamePrimary}>{item.originalName}</span>
                          <span className={styles.fileNameMeta}>
                            <span>
                              {item.extension ? `.${item.extension}` : "Sin extensión"} ·{" "}
                              {formatDestinationTypeLabel(item.destinationType)}
                            </span>
                            <span className={styles.fileNameMetaSeparator} aria-hidden>
                              |
                            </span>
                            <span>{formatFileSize(item.sizeBytes)}</span>
                          </span>
                        </td>
                        <td>{formatAdminDateTime(item.uploadedAt)}</td>
                        <td className={styles.hideTablet}>{item.uploadedBy.name}</td>
                        <td>{formatDestinationTypeLabel(item.destinationType)}</td>
                        <DestinationCell latestJob={item.latestJob} />
                        <td>
                          {item.latestJob ? (
                            <ImportJobStatusBadge status={item.latestJob.status} />
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td className={styles.metricCell}>
                          {formatImportMetrics(item.latestJob)}
                        </td>
                        <td className={styles.actionsCell}>
                          <div className={styles.actionsGroup}>
                            {isAdmin ? (
                              <>
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
                                  className={styles.iconButtonSuccess}
                                  onClick={() => onDownload(item.id)}
                                  aria-label={`Descargar ${item.originalName}`}
                                  disabled={isBusy}
                                >
                                  <FileDown strokeWidth={ICON_STROKE} aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  className={styles.iconButtonDanger}
                                  onClick={() => onDelete(item)}
                                  aria-label={`Eliminar ${item.originalName}`}
                                  disabled={isBusy}
                                >
                                  <Trash2 strokeWidth={ICON_STROKE} aria-hidden />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className={styles.downloadActionButton}
                                onClick={() => onDownload(item.id)}
                                aria-label={`Descargar ${item.originalName}`}
                                disabled={isBusy}
                              >
                                <FileDown strokeWidth={ICON_STROKE} aria-hidden />
                                Descargar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.cardList}>
              {data.items.map((item) => {
                const isBusy = isActionBusy && busyFileId === item.id;

                return (
                  <article key={item.id} className={styles.fileCard}>
                    <div className={styles.fileCardHeader}>
                      <div className={styles.fileCardTitleBlock}>
                        <h2 className={styles.fileCardTitle}>{item.originalName}</h2>
                        <p className={styles.fileNameMeta}>
                          <span>
                            {item.extension ? `.${item.extension}` : "Sin extensión"} ·{" "}
                            {formatDestinationTypeLabel(item.destinationType)}
                          </span>
                          <span className={styles.fileNameMetaSeparator} aria-hidden>
                            |
                          </span>
                          <span>{formatFileSize(item.sizeBytes)}</span>
                        </p>
                      </div>
                      {item.latestJob ? (
                        <ImportJobStatusBadge status={item.latestJob.status} />
                      ) : null}
                    </div>

                    <dl className={styles.fileCardMeta}>
                      <div className={styles.fileCardMetaItem}>
                        <dt className={styles.fileCardMetaLabel}>Fecha</dt>
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
                        <DestinationInline latestJob={item.latestJob} />
                        <br />
                        {formatImportMetrics(item.latestJob)}
                      </p>
                    </div>

                    <div
                      className={
                        isAdmin
                          ? styles.fileCardActions
                          : `${styles.fileCardActions} ${styles.fileCardActionsSingle}`
                      }
                    >
                      {isAdmin ? (
                        <>
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
                            className={`${styles.cardActionButton} ${styles.cardActionButtonSuccess}`}
                            onClick={() => onDownload(item.id)}
                            disabled={isBusy}
                          >
                            <FileDown strokeWidth={ICON_STROKE} aria-hidden />
                            Descargar
                          </button>
                          <button
                            type="button"
                            className={`${styles.cardActionButton} ${styles.cardActionButtonDanger}`}
                            onClick={() => onDelete(item)}
                            disabled={isBusy}
                          >
                            <Trash2 strokeWidth={ICON_STROKE} aria-hidden />
                            Eliminar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={`${styles.cardActionButton} ${styles.cardActionButtonSuccess}`}
                          onClick={() => onDownload(item.id)}
                          disabled={isBusy}
                        >
                          <FileDown strokeWidth={ICON_STROKE} aria-hidden />
                          Descargar
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )
        )}
      </div>

      {data.items.length > 0 ? (
        <footer className={styles.tableFooter}>
          <p className={styles.tableSummary}>
            Mostrando {from} a {to} de {pagination.total} archivos
          </p>

          <div className={styles.tablePagination}>
            <button
              type="button"
              className={styles.paginationButton}
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft strokeWidth={ICON_STROKE} aria-hidden />
            </button>

            <span className={styles.paginationLabel}>
              Página {pagination.page} de {Math.max(pagination.totalPages, 1)}
            </span>

            <button
              type="button"
              className={styles.paginationButton}
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
