"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import catalogStyles from "@/features/catalog/styles/CatalogNavigator.module.scss";
import { FilesPageIntro } from "@/features/files/components/FilesPageIntro";
import { UploadedFileDetailModal } from "@/features/files/components/UploadedFileDetailModal";
import { UploadedFileReportModal } from "@/features/files/components/UploadedFileReportModal";
import { UploadedFilesList } from "@/features/files/components/UploadedFilesList";
import {
  deleteUploadedFileAction,
  getUploadedFileDetailAction,
  getUploadedFileDownloadUrlAction,
  getUploadedFileReportAction,
  reprocessUploadedFileAction,
} from "@/features/files/actions/uploaded-file.actions";
import type {
  UploadedFileDetail,
  UploadedFileListResponse,
  UploadedFileReportResponse,
} from "@/features/files/types/uploaded-file.types";
import type { DirectoryCatalogItem } from "@/features/directory/types/directory.types";
import { ImportWizard } from "@/features/imports/components/ImportWizard";
import styles from "@/features/files/styles/FilesManager.module.scss";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type FilesManagerProps = {
  catalogs: DirectoryCatalogItem[];
};

function readErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }

  return fallback;
}

export function FilesManager({ catalogs }: FilesManagerProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UploadedFileListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UploadedFileDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailActionError, setDetailActionError] = useState<string | null>(null);

  const [reportFileId, setReportFileId] = useState<string | null>(null);
  const [report, setReport] = useState<UploadedFileReportResponse | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [isActionBusy, setIsActionBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UploadedFileDetail | null>(null);
  const [deleteRequiresConfirmation, setDeleteRequiresConfirmation] = useState(false);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [wizardJobId, setWizardJobId] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function loadFiles() {
      setIsLoading(true);
      setListError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });

        if (debouncedQuery) {
          params.set("q", debouncedQuery);
        }

        const response = await fetch(`/api/admin/files?${params.toString()}`);

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(readErrorMessage(payload, "No se pudieron cargar los archivos."));
        }

        const payload = (await response.json()) as UploadedFileListResponse;

        if (!cancelled) {
          setData(payload);
        }
      } catch (caught) {
        if (!cancelled) {
          setData(null);
          setListError(
            caught instanceof Error
              ? caught.message
              : "No se pudieron cargar los archivos.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadFiles();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, page, reloadToken]);

  const refreshList = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  const loadDetail = useCallback(async (fileId: string) => {
    setIsDetailLoading(true);
    setDetailError(null);
    setDetailActionError(null);

    const result = await getUploadedFileDetailAction({ fileId });

    if (!result.success) {
      setDetail(null);
      setDetailError(result.error);
      setIsDetailLoading(false);
      return;
    }

    setDetail(result.data);
    setIsDetailLoading(false);
  }, []);

  const handleViewDetail = useCallback(
    (fileId: string) => {
      setDetailFileId(fileId);
      setDetail(null);
      void loadDetail(fileId);
    },
    [loadDetail],
  );

  const handleCloseDetail = useCallback(() => {
    if (isActionBusy) {
      return;
    }

    setDetailFileId(null);
    setDetail(null);
    setDetailError(null);
    setDetailActionError(null);
  }, [isActionBusy]);

  const handleDownload = useCallback(async (fileId: string) => {
    setBusyFileId(fileId);
    setIsActionBusy(true);
    setDetailActionError(null);

    const result = await getUploadedFileDownloadUrlAction({ fileId });

    setBusyFileId(null);
    setIsActionBusy(false);

    if (!result.success) {
      setDetailActionError(result.error);
      return;
    }

    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }, []);

  const handleOpenReport = useCallback(
    async (fileId: string, jobId?: string) => {
      setReportFileId(fileId);
      setReport(null);
      setReportError(null);
      setIsReportLoading(true);

      const result = await getUploadedFileReportAction({ fileId, jobId });

      setIsReportLoading(false);

      if (!result.success) {
        setReportError(result.error);
        return;
      }

      setReport(result.data);
    },
    [],
  );

  const handleCloseReport = useCallback(() => {
    if (isReportLoading) {
      return;
    }

    setReportFileId(null);
    setReport(null);
    setReportError(null);
  }, [isReportLoading]);

  const handleReprocess = useCallback(async () => {
    if (!detail) {
      return;
    }

    setIsActionBusy(true);
    setDetailActionError(null);

    const result = await reprocessUploadedFileAction({ fileId: detail.id });

    setIsActionBusy(false);

    if (!result.success) {
      setDetailActionError(result.error);
      return;
    }

    setDetailFileId(null);
    setDetail(null);
    setWizardJobId(result.data.jobId);
    setIsImportOpen(true);
    refreshList();
  }, [detail, refreshList]);

  const handleDeleteRequest = useCallback(() => {
    if (!detail) {
      return;
    }

    setDeleteRequiresConfirmation(false);
    setDeleteTarget(detail);
  }, [detail]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    setIsActionBusy(true);
    setDetailActionError(null);

    const result = await deleteUploadedFileAction({
      fileId: deleteTarget.id,
      confirmed: deleteRequiresConfirmation,
    });

    if (!result.success) {
      setIsActionBusy(false);

      if (result.code === "CONFIRMATION_REQUIRED") {
        setDeleteRequiresConfirmation(true);
        return;
      }

      setDetailActionError(result.error);
      setDeleteTarget(null);
      return;
    }

    setIsActionBusy(false);
    setDeleteTarget(null);
    setDeleteRequiresConfirmation(false);
    setDetailFileId(null);
    setDetail(null);
    refreshList();
  }, [deleteRequiresConfirmation, deleteTarget, refreshList]);

  const handleImportPublished = useCallback(() => {
    setIsImportOpen(false);
    setWizardJobId(null);
    refreshList();
  }, [refreshList]);

  const handleImportClose = useCallback(() => {
    setIsImportOpen(false);
    setWizardJobId(null);
    refreshList();
  }, [refreshList]);

  return (
    <>
      <div className={styles.page}>
        <div className={styles.body}>
          <FilesPageIntro query={query} onQueryChange={setQuery} />
          <UploadedFilesList
            data={data}
            isLoading={isLoading}
            error={listError}
            onPageChange={setPage}
            onViewDetail={handleViewDetail}
            onDownload={(fileId) => void handleDownload(fileId)}
            isActionBusy={isActionBusy}
            busyFileId={busyFileId}
          />
        </div>
      </div>

      <UploadedFileDetailModal
        isOpen={detailFileId !== null}
        isLoading={isDetailLoading}
        error={detailError}
        detail={detail}
        isBusy={isActionBusy}
        actionError={detailActionError}
        onClose={handleCloseDetail}
        onDownload={() => {
          if (detail) {
            void handleDownload(detail.id);
          }
        }}
        onReprocess={() => void handleReprocess()}
        onDelete={handleDeleteRequest}
        onViewReport={(jobId) => {
          if (detail) {
            void handleOpenReport(detail.id, jobId);
          }
        }}
      />

      <UploadedFileReportModal
        isOpen={reportFileId !== null}
        isLoading={isReportLoading}
        error={reportError}
        report={report}
        onClose={handleCloseReport}
      />

      {deleteTarget ? (
        <ConfirmDialog
          title={
            deleteRequiresConfirmation
              ? "Confirmar eliminación definitiva"
              : "Eliminar archivo"
          }
          message={
            deleteRequiresConfirmation ? (
              <>
                El archivo{" "}
                <strong className={catalogStyles.confirmHighlight}>
                  {deleteTarget.originalName}
                </strong>{" "}
                tiene importaciones publicadas o en revisión. Si lo eliminás, se borrará
                también el respaldo original en almacenamiento.
              </>
            ) : (
              <>
                ¿Eliminar el archivo{" "}
                <strong className={catalogStyles.confirmHighlight}>
                  {deleteTarget.originalName}
                </strong>
                ? Esta acción no se puede deshacer.
              </>
            )
          }
          confirmLabel={deleteRequiresConfirmation ? "Sí, eliminar archivo" : "Eliminar"}
          variant="danger"
          isBusy={isActionBusy}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => {
            if (!isActionBusy) {
              setDeleteTarget(null);
              setDeleteRequiresConfirmation(false);
            }
          }}
        />
      ) : null}

      {isImportOpen ? (
        <ImportWizard
          catalogs={catalogs}
          initialJobId={wizardJobId ?? undefined}
          onClose={handleImportClose}
          onPublished={handleImportPublished}
        />
      ) : null}
    </>
  );
}
