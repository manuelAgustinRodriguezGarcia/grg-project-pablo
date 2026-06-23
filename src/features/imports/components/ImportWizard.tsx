"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ImportActionType } from "@/generated/prisma/client";
import {
  createCatalogAction,
  deleteCatalogAction,
  updateCatalogAction,
} from "@/features/catalog/actions/catalog.actions";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import { createFolderAction } from "@/features/catalog/actions/folder.actions";
import type { CatalogListItem } from "@/features/catalog/types/catalog.types";
import catalogStyles from "@/features/catalog/styles/CatalogNavigator.module.scss";
import type { DirectoryCatalogItem } from "@/features/directory/types/directory.types";
import type {
  CatalogNavigationFolderItem,
  CatalogNavigationResponse,
} from "@/features/catalog/types/navigation.types";
import {
  analyzeImportAction,
  applyImportAction,
  cancelImportAction,
  setImportConfigAction,
  setImportDestinationAction,
} from "@/features/imports/actions/import.actions";
import type {
  ImportPreviewResponse,
  ImportSheetItem,
} from "@/features/imports/types/import-job.types";
import type {
  ImportReportData,
  ImportReportResponse,
  ImportSheetsResponse,
  ImportWizardStep,
} from "@/features/imports/types/import-wizard.types";
import { AlertTriangle, ArrowLeft, ArrowRight, FileSpreadsheet, ICON_STROKE } from "@/shared/icons";
import { ImportStepDestination } from "./ImportStepDestination";
import { ImportStepPreview } from "./ImportStepPreview";
import { ImportStepResult } from "./ImportStepResult";
import { ImportStepUpload } from "./ImportStepUpload";
import { ImportWizardLoading } from "./ImportWizardLoading";
import styles from "./ImportWizard.module.scss";

type ImportWizardProps = {
  catalogs: DirectoryCatalogItem[];
  onClose: () => void;
  onPublished: () => void;
};

const STEP_ORDER: ImportWizardStep[] = [
  "upload",
  "destination",
  "preview",
  "result",
];

const STEP_LABELS: Record<ImportWizardStep, string> = {
  upload: "Archivo",
  destination: "Destino",
  preview: "Vista previa",
  result: "Resultado",
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

type CatalogTarget = {
  id: string;
  name: string;
};

function toDirectoryCatalogItem(catalog: CatalogListItem): DirectoryCatalogItem {
  return {
    id: catalog.id,
    name: catalog.name,
    description: catalog.description,
    coverImageUrl: null,
    sectionCount: catalog.folderCount,
    updatedAt: catalog.updatedAt,
    order: catalog.order,
    offlineSync: { status: "unavailable" },
  };
}

type LoadingOverlayState = {
  message: string;
  progressTarget: number;
  isComplete: boolean;
};

export function ImportWizard({ catalogs, onClose, onPublished }: ImportWizardProps) {
  const [step, setStep] = useState<ImportWizardStep>("upload");
  const [loadingOverlay, setLoadingOverlay] = useState<LoadingOverlayState | null>(null);
  const [loadingSession, setLoadingSession] = useState(0);
  const [inlineBusy, setInlineBusy] = useState(false);
  const [isCatalogActionBusy, setIsCatalogActionBusy] = useState(false);
  const [deleteCatalogTarget, setDeleteCatalogTarget] = useState<CatalogTarget | null>(null);
  const [editCatalogTarget, setEditCatalogTarget] = useState<CatalogTarget | null>(null);
  const [editCatalogNameDraft, setEditCatalogNameDraft] = useState("");
  const loadingExitResolver = useRef<(() => void) | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isBusy = loadingOverlay !== null || inlineBusy || isCatalogActionBusy;

  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const [catalogList, setCatalogList] = useState<DirectoryCatalogItem[]>(catalogs);
  const [folders, setFolders] = useState<CatalogNavigationFolderItem[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [sheets, setSheets] = useState<ImportSheetItem[]>([]);

  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedSheetName, setSelectedSheetName] = useState("");

  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [selectedAction, setSelectedAction] = useState<ImportActionType | null>(null);
  const [confirmAction, setConfirmAction] = useState<ImportActionType | null>(null);

  const [report, setReport] = useState<ImportReportData | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const importableSheets = sheets.filter(
    (sheet) => sheet.classification === "IMPORTABLE",
  );
  const excludedSheetCount = sheets.length - importableSheets.length;

  const selectedCatalog = catalogList.find((item) => item.id === selectedCatalogId);
  const selectedFolder = folders.find((item) => item.id === selectedFolderId);

  const waitForLoadingExit = useCallback(() => {
    return new Promise<void>((resolve) => {
      loadingExitResolver.current = resolve;
    });
  }, []);

  const handleLoadingExitComplete = useCallback(() => {
    setLoadingOverlay(null);
    const resolve = loadingExitResolver.current;
    loadingExitResolver.current = null;
    resolve?.();
  }, []);

  const clearLoadingImmediate = useCallback(() => {
    setLoadingOverlay(null);
    const resolve = loadingExitResolver.current;
    loadingExitResolver.current = null;
    resolve?.();
  }, []);

  const startLoadingOverlay = useCallback((message: string, progressTarget: number) => {
    setLoadingSession((session) => session + 1);
    setLoadingOverlay({ message, progressTarget, isComplete: false });
  }, []);

  const updateLoadingOverlay = useCallback(
    (message: string, progressTarget: number) => {
      setLoadingOverlay({ message, progressTarget, isComplete: false });
    },
    [],
  );

  const completeLoadingOverlay = useCallback(async () => {
    setLoadingOverlay((current) =>
      current ? { ...current, progressTarget: 100, isComplete: true } : null,
    );
    await waitForLoadingExit();
  }, [waitForLoadingExit]);

  const loadFolders = useCallback(async (catalogId: string) => {
    setIsLoadingFolders(true);
    try {
      const response = await fetch(`/api/admin/catalogs/${catalogId}/navigation`);
      if (!response.ok) {
        setFolders([]);
        return;
      }
      const data = (await response.json()) as CatalogNavigationResponse;
      setFolders(data.folders);
    } catch {
      setFolders([]);
    } finally {
      setIsLoadingFolders(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    if (isBusy) {
      return;
    }
    if (jobId && step !== "result") {
      void cancelImportAction({ jobId });
    }
    onClose();
  }, [isBusy, jobId, step, onClose]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  async function handleUploadContinue() {
    if (!file) {
      return;
    }

    setError(null);
    setSelectedCatalogId("");
    setSelectedFolderId("");
    setSelectedSheetName("");
    startLoadingOverlay("Subiendo archivo…", 12);

    try {
      const formData = new FormData();
      formData.append("file", file);

      updateLoadingOverlay("Subiendo archivo…", 28);

      const uploadResponse = await fetch("/api/admin/imports/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const payload = await uploadResponse.json().catch(() => null);
        throw new Error(readErrorMessage(payload, "No se pudo subir el archivo."));
      }

      const { jobId: newJobId } = (await uploadResponse.json()) as {
        jobId: string;
      };
      setJobId(newJobId);

      updateLoadingOverlay("Analizando el archivo…", 48);

      const analyzeResult = await analyzeImportAction({ jobId: newJobId });
      if (!analyzeResult.success) {
        throw new Error(analyzeResult.error);
      }

      updateLoadingOverlay("Leyendo hojas del archivo…", 72);

      const sheetsResponse = await fetch(
        `/api/admin/imports/${newJobId}/sheets`,
      );
      if (!sheetsResponse.ok) {
        const payload = await sheetsResponse.json().catch(() => null);
        throw new Error(
          readErrorMessage(payload, "No se pudieron leer las hojas del archivo."),
        );
      }

      const sheetsData = (await sheetsResponse.json()) as ImportSheetsResponse;
      setSheets(sheetsData.sheets);
      setSelectedSheetName("");

      updateLoadingOverlay("Finalizando análisis…", 92);
      await completeLoadingOverlay();
      setStep("destination");
    } catch (caught) {
      clearLoadingImmediate();
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo analizar el archivo.",
      );
    }
  }

  function handleSelectCatalog(catalogId: string) {
    setSelectedCatalogId(catalogId);
    setSelectedFolderId("");
    setFolders([]);
    void loadFolders(catalogId);
  }

  async function handleCreateCatalog(name: string): Promise<boolean> {
    setInlineBusy(true);
    setError(null);
    try {
      const result = await createCatalogAction({ name });
      if (!result.success) {
        setError(result.error);
        return false;
      }
      const created: DirectoryCatalogItem = {
        id: result.data.id,
        name: result.data.name,
        description: result.data.description,
        coverImageUrl: null,
        sectionCount: 0,
        updatedAt: result.data.updatedAt,
        order: result.data.order,
        offlineSync: { status: "unavailable" },
      };
      setCatalogList((current) => [...current, created]);
      setSelectedCatalogId(created.id);
      setSelectedFolderId("");
      setFolders([]);
      return true;
    } finally {
      setInlineBusy(false);
    }
  }

  async function handleCreateFolder(name: string): Promise<boolean> {
    if (!selectedCatalogId) {
      return false;
    }
    setInlineBusy(true);
    setError(null);
    try {
      const result = await createFolderAction({
        catalogId: selectedCatalogId,
        name,
      });
      if (!result.success) {
        setError(result.error);
        return false;
      }
      const created: CatalogNavigationFolderItem = {
        id: result.data.id,
        name: result.data.name,
        description: result.data.description,
        order: result.data.order,
        visibleToNormalUser: result.data.visibleToNormalUser,
        productCount: result.data.productCount,
        updatedAt: result.data.updatedAt,
      };
      setFolders((current) => [...current, created]);
      setSelectedFolderId(created.id);
      return true;
    } finally {
      setInlineBusy(false);
    }
  }

  const handleEditCatalog = useCallback(
    (catalogId: string) => {
      const catalog = catalogList.find((item) => item.id === catalogId);
      if (!catalog) {
        return;
      }
      setError(null);
      setEditCatalogTarget({ id: catalog.id, name: catalog.name });
      setEditCatalogNameDraft(catalog.name);
    },
    [catalogList],
  );

  const handleDeleteCatalog = useCallback(
    (catalogId: string) => {
      const catalog = catalogList.find((item) => item.id === catalogId);
      if (!catalog) {
        return;
      }
      setError(null);
      setDeleteCatalogTarget({ id: catalog.id, name: catalog.name });
    },
    [catalogList],
  );

  const handleConfirmDeleteCatalog = useCallback(async () => {
    if (!deleteCatalogTarget) {
      return;
    }

    setIsCatalogActionBusy(true);
    setError(null);

    try {
      const result = await deleteCatalogAction({ catalogId: deleteCatalogTarget.id });
      if (!result.success) {
        setError(result.error);
        return;
      }

      const nextCatalogs = catalogList.filter(
        (catalog) => catalog.id !== deleteCatalogTarget.id,
      );
      setCatalogList(nextCatalogs);

      if (selectedCatalogId === deleteCatalogTarget.id) {
        const nextCatalogId = nextCatalogs[0]?.id ?? "";
        setSelectedCatalogId(nextCatalogId);
        setSelectedFolderId("");
        setFolders([]);
      }

      setDeleteCatalogTarget(null);
    } finally {
      setIsCatalogActionBusy(false);
    }
  }, [catalogList, deleteCatalogTarget, selectedCatalogId]);

  const handleConfirmEditCatalog = useCallback(async () => {
    if (!editCatalogTarget) {
      return;
    }

    const nextName = editCatalogNameDraft.trim();
    if (!nextName) {
      setError("El nombre no puede estar vacío.");
      return;
    }

    setIsCatalogActionBusy(true);
    setError(null);

    try {
      const result = await updateCatalogAction({
        id: editCatalogTarget.id,
        name: nextName,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }

      const updated = toDirectoryCatalogItem(result.data);
      setCatalogList((current) =>
        current.map((catalog) => (catalog.id === updated.id ? updated : catalog)),
      );
      setEditCatalogTarget(null);
      setEditCatalogNameDraft("");
    } finally {
      setIsCatalogActionBusy(false);
    }
  }, [editCatalogNameDraft, editCatalogTarget]);

  const editCatalogNameEmpty = editCatalogNameDraft.trim().length === 0;
  const editCatalogNameUnchanged =
    editCatalogTarget !== null &&
    editCatalogNameDraft.trim() === editCatalogTarget.name.trim();

  async function handleDestinationContinue() {
    if (!jobId || !selectedCatalogId || !selectedFolderId || !selectedSheetName) {
      return;
    }

    setError(null);
    startLoadingOverlay("Configurando destino…", 15);

    try {
      updateLoadingOverlay("Configurando destino…", 32);

      const destinationResult = await setImportDestinationAction({
        jobId,
        catalogId: selectedCatalogId,
        folderId: selectedFolderId,
        sheetName: selectedSheetName,
      });
      if (!destinationResult.success) {
        throw new Error(destinationResult.error);
      }

      updateLoadingOverlay("Preparando columnas…", 55);

      const configResult = await setImportConfigAction({ jobId });
      if (!configResult.success) {
        throw new Error(configResult.error);
      }

      updateLoadingOverlay("Generando la vista previa…", 78);

      const previewResponse = await fetch(
        `/api/admin/imports/${jobId}/preview?page=1&pageSize=50`,
      );
      if (!previewResponse.ok) {
        const payload = await previewResponse.json().catch(() => null);
        throw new Error(
          readErrorMessage(payload, "No se pudo generar la vista previa."),
        );
      }

      const previewData = (await previewResponse.json()) as ImportPreviewResponse;
      setPreview(previewData);
      setSelectedAction(
        previewData.summary.folderIsEmpty ? "IMPORTAR_LISTA" : null,
      );

      updateLoadingOverlay("Vista previa lista…", 93);
      await completeLoadingOverlay();
      setStep("preview");
    } catch (caught) {
      clearLoadingImmediate();
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo generar la vista previa.",
      );
    }
  }

  function handleImportClick() {
    if (!selectedAction) {
      return;
    }
    if (selectedAction === "IMPORTAR_LISTA") {
      void applyImport(selectedAction);
      return;
    }
    setConfirmAction(selectedAction);
  }

  async function applyImport(action: ImportActionType) {
    if (!jobId) {
      return;
    }

    setConfirmAction(null);
    setError(null);
    startLoadingOverlay("Importando productos…", 18);

    try {
      updateLoadingOverlay("Importando productos…", 45);

      const applyResult = await applyImportAction({
        jobId,
        actionType: action,
        confirmed: true,
      });
      if (!applyResult.success) {
        throw new Error(applyResult.error);
      }

      updateLoadingOverlay("Generando informe…", 78);

      const reportResponse = await fetch(`/api/admin/imports/${jobId}/report`);
      if (reportResponse.ok) {
        const reportData = (await reportResponse.json()) as ImportReportResponse;
        setReport(reportData.report);
        setReportError(reportData.errorMessage);
      } else {
        setReport(null);
        setReportError(null);
      }

      updateLoadingOverlay("Importación completa…", 94);
      await completeLoadingOverlay();
      setStep("result");
    } catch (caught) {
      clearLoadingImmediate();
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo completar la importación.",
      );
    }
  }

  function handleFinish() {
    onPublished();
    onClose();
  }

  const currentStepIndex = STEP_ORDER.indexOf(step);
  const canContinueDestination = Boolean(
    selectedCatalogId && selectedFolderId && selectedSheetName,
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Asistente de importación de Excel"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.titleIcon} aria-hidden>
              <FileSpreadsheet strokeWidth={ICON_STROKE} />
            </span>
            <h2 className={styles.title}>Importar Excel</h2>
          </div>
        </header>

        <div className={styles.steps} aria-hidden>
          {STEP_ORDER.map((stepId, index) => {
            const isActive = index === currentStepIndex;
            const isDone = index < currentStepIndex;
            const stepClass = isActive
              ? styles.stepActive
              : isDone
                ? styles.stepDone
                : "";
            return (
              <Fragment key={stepId}>
                {index > 0 ? <span className={styles.stepDivider} /> : null}
                <div className={styles.stepItem}>
                  <span className={`${styles.step} ${stepClass}`}>
                    <span className={styles.stepIndex}>{index + 1}</span>
                    <span className={styles.stepLabel}>{STEP_LABELS[stepId]}</span>
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>

        <div className={styles.bodyArea}>
          {error ? (
            <p className={styles.error}>
              <AlertTriangle
                className={styles.errorIcon}
                strokeWidth={ICON_STROKE}
                aria-hidden
              />
              {error}
            </p>
          ) : null}

          {loadingOverlay ? (
            <ImportWizardLoading
              key={loadingSession}
              message={loadingOverlay.message}
              progressTarget={loadingOverlay.progressTarget}
              isComplete={loadingOverlay.isComplete}
              onExitComplete={handleLoadingExitComplete}
            />
          ) : (
            <>
              {step === "upload" ? (
                <ImportStepUpload
                  file={file}
                  disabled={isBusy}
                  onFileSelected={(next) => {
                    setFile(next);
                    setError(null);
                  }}
                />
              ) : null}

              {step === "destination" ? (
                <ImportStepDestination
                  fileName={file?.name ?? ""}
                  catalogs={catalogList}
                  folders={folders}
                  importableSheets={importableSheets}
                  excludedSheetCount={excludedSheetCount}
                  selectedCatalogId={selectedCatalogId}
                  selectedFolderId={selectedFolderId}
                  selectedSheetName={selectedSheetName}
                  isLoadingFolders={isLoadingFolders}
                  isBusy={isBusy}
                  onSelectCatalog={handleSelectCatalog}
                  onSelectFolder={setSelectedFolderId}
                  onSelectSheet={setSelectedSheetName}
                  onCreateCatalog={handleCreateCatalog}
                  onCreateFolder={handleCreateFolder}
                  onEditCatalog={handleEditCatalog}
                  onDeleteCatalog={handleDeleteCatalog}
                />
              ) : null}

              {step === "preview" && preview ? (
                <ImportStepPreview
                  preview={preview}
                  catalogName={selectedCatalog?.name ?? ""}
                  folderName={selectedFolder?.name ?? ""}
                  sheetName={selectedSheetName}
                  selectedAction={selectedAction}
                  onSelectAction={setSelectedAction}
                />
              ) : null}

              {step === "result" ? (
                <ImportStepResult report={report} errorMessage={reportError} />
              ) : null}
            </>
          )}
        </div>

        <footer className={styles.footer}>
          {step === "destination" || step === "preview" ? (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() =>
                setStep(step === "preview" ? "destination" : "upload")
              }
              disabled={isBusy}
            >
              <ArrowLeft className={styles.buttonIcon} strokeWidth={ICON_STROKE} aria-hidden />
              Atrás
            </button>
          ) : null}

          <div className={styles.footerRight}>
            {step === "upload" ? (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handleUploadContinue()}
                disabled={isBusy || !file}
              >
                Continuar
                <ArrowRight className={styles.buttonIcon} strokeWidth={ICON_STROKE} aria-hidden />
              </button>
            ) : null}

            {step === "destination" ? (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handleDestinationContinue()}
                disabled={isBusy || !canContinueDestination}
              >
                Continuar
                <ArrowRight className={styles.buttonIcon} strokeWidth={ICON_STROKE} aria-hidden />
              </button>
            ) : null}

            {step === "preview" ? (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleImportClick}
                disabled={isBusy || !selectedAction}
              >
                Importar
              </button>
            ) : null}

            {step === "result" ? (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleFinish}
              >
                Finalizar
              </button>
            ) : null}
          </div>
        </footer>

        {deleteCatalogTarget ? (
          <ConfirmDialog
            title="Eliminar catálogo"
            message={
              <>
                ¿Eliminar el catálogo{" "}
                <strong className={catalogStyles.confirmHighlight}>
                  {deleteCatalogTarget.name}
                </strong>
                ? También se eliminarán todas sus carpetas y productos. Esta acción no
                se puede deshacer.
              </>
            }
            confirmLabel="Eliminar"
            variant="danger"
            isBusy={isCatalogActionBusy}
            onConfirm={() => void handleConfirmDeleteCatalog()}
            onCancel={() => {
              if (!isCatalogActionBusy) {
                setDeleteCatalogTarget(null);
              }
            }}
          />
        ) : null}
        {editCatalogTarget ? (
          <ConfirmDialog
            title="Editar catálogo"
            message={
              <>
                ¿Confirmás el cambio de nombre del catálogo{" "}
                <strong className={catalogStyles.confirmHighlight}>
                  {editCatalogTarget.name}
                </strong>
                ?
              </>
            }
            confirmLabel="Guardar cambios"
            isBusy={isCatalogActionBusy}
            confirmDisabled={editCatalogNameEmpty || editCatalogNameUnchanged}
            onConfirm={() => void handleConfirmEditCatalog()}
            onCancel={() => {
              if (!isCatalogActionBusy) {
                setEditCatalogTarget(null);
                setEditCatalogNameDraft("");
              }
            }}
          >
            <input
              className={catalogStyles.confirmInput}
              value={editCatalogNameDraft}
              onChange={(event) => setEditCatalogNameDraft(event.target.value)}
              maxLength={200}
              autoFocus
              disabled={isCatalogActionBusy}
              aria-label="Nuevo nombre del catálogo"
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !editCatalogNameEmpty &&
                  !editCatalogNameUnchanged &&
                  !isCatalogActionBusy
                ) {
                  event.preventDefault();
                  void handleConfirmEditCatalog();
                }
              }}
            />
          </ConfirmDialog>
        ) : null}

        {confirmAction ? (
          <div className={styles.confirmOverlay}>
            <div
              className={styles.confirmCard}
              role="alertdialog"
              aria-modal="true"
              aria-label="Confirmar importación"
            >
              <h3 className={styles.confirmTitle}>
                {confirmAction === "REEMPLAZAR_LISTA"
                  ? "Reemplazar productos"
                  : "Combinar productos"}
              </h3>
              <p className={styles.confirmText}>
                {confirmAction === "REEMPLAZAR_LISTA"
                  ? `Se eliminarán los ${preview?.summary.folderProductCount ?? 0} productos actuales de la carpeta y se reemplazarán por la nueva lista. Esta acción no se puede deshacer.`
                  : "Se agregarán únicamente los productos nuevos y se mantendrán los existentes. ¿Querés continuar?"}
              </p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => setConfirmAction(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={
                    confirmAction === "REEMPLAZAR_LISTA"
                      ? styles.dangerButton
                      : styles.primaryButton
                  }
                  onClick={() => void applyImport(confirmAction)}
                >
                  {confirmAction === "REEMPLAZAR_LISTA" ? "Reemplazar" : "Combinar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
