"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useEscapeToClose } from "@/features/billing/hooks/useBillingModalKeyboard";
import {
  defaultDeudoresPeriodDraft,
  deudoresYearOptions,
  resolveDeudoresPeriod,
  type DeudoresPeriodKind,
  type DeudoresPeriodSelection,
} from "@/features/billing/utils/deudores-period";
import { CustomDatePicker } from "@/shared/components/CustomDatePicker";
import { CustomMonthPicker } from "@/shared/components/CustomMonthPicker";
import { CustomSelect } from "@/shared/components/CustomSelect";
import { FileSpreadsheet, ICON_STROKE, Printer, X } from "@/shared/icons";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type DeudoresPeriodDialogProps = {
  initial?: DeudoresPeriodSelection | null;
  onApply: (selection: DeudoresPeriodSelection) => void;
  onPrint: (selection: DeudoresPeriodSelection) => void;
  onExcel: (selection: DeudoresPeriodSelection) => void | Promise<void>;
  excelBusy?: boolean;
  onClose: () => void;
};

export function DeudoresPeriodDialog({
  initial,
  onApply,
  onPrint,
  onExcel,
  excelBusy = false,
  onClose,
}: DeudoresPeriodDialogProps) {
  const draftDefaults = defaultDeudoresPeriodDraft();
  const [period, setPeriod] = useState<DeudoresPeriodKind>(
    initial?.kind ?? draftDefaults.kind,
  );
  const [monthValue, setMonthValue] = useState(
    initial?.kind === "monthly"
      ? initial.fromDate.slice(0, 7)
      : draftDefaults.monthValue,
  );
  const [fromValue, setFromValue] = useState(
    initial?.kind === "custom" ? initial.fromDate : draftDefaults.fromValue,
  );
  const [toValue, setToValue] = useState(
    initial?.kind === "custom" ? initial.toDate : draftDefaults.toValue,
  );
  const [year, setYear] = useState(
    initial?.kind === "annual"
      ? Number(initial.fromDate.slice(0, 4))
      : draftDefaults.year,
  );
  const [error, setError] = useState<string | null>(null);

  const yearOptions = deudoresYearOptions().map((value) => ({
    value: String(value),
    label: String(value),
  }));

  useEscapeToClose(onClose);

  function resolveSelection(): DeudoresPeriodSelection | null {
    const resolved = resolveDeudoresPeriod({
      kind: period,
      monthValue,
      fromValue,
      toValue,
      year,
    });
    if ("error" in resolved) {
      setError(resolved.error);
      return null;
    }
    setError(null);
    return resolved;
  }

  function apply(): void {
    const resolved = resolveSelection();
    if (!resolved) {
      return;
    }
    onApply(resolved);
  }

  function handlePrint(): void {
    const resolved = resolveSelection();
    if (!resolved) {
      return;
    }
    onPrint(resolved);
  }

  function handleExcel(): void {
    const resolved = resolveSelection();
    if (!resolved) {
      return;
    }
    void onExcel(resolved);
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`${modalStyles.modalOverlay} ${styles.receiptFormOverlay}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`${modalStyles.modalCard} ${styles.libroIvaCard}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deudores-period-title"
      >
        <header className={styles.invoiceDetailHeader}>
          <div>
            <h2
              id="deudores-period-title"
              className={styles.invoiceDetailTitle}
            >
              Período
            </h2>
            <p className={styles.invoiceDetailSubtitle}>
              Filtrá la deuda por mes, rango personalizado o año.
            </p>
          </div>
          <button
            type="button"
            className={styles.invoiceDetailClose}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </header>

        <div className={styles.libroIvaSheet}>
          <div className={styles.libroIvaFields}>
            <div
              className={styles.libroIvaPeriodToggle}
              role="radiogroup"
              aria-label="Tipo de período"
            >
              <button
                type="button"
                role="radio"
                aria-checked={period === "monthly"}
                className={`${styles.libroIvaPeriodButton} ${
                  period === "monthly" ? styles.libroIvaPeriodButtonActive : ""
                }`}
                onClick={() => setPeriod("monthly")}
              >
                Mensual
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={period === "custom"}
                className={`${styles.libroIvaPeriodButton} ${
                  period === "custom" ? styles.libroIvaPeriodButtonActive : ""
                }`}
                onClick={() => setPeriod("custom")}
              >
                Personalizado
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={period === "annual"}
                className={`${styles.libroIvaPeriodButton} ${
                  period === "annual" ? styles.libroIvaPeriodButtonActive : ""
                }`}
                onClick={() => setPeriod("annual")}
              >
                Anual
              </button>
            </div>

            {period === "monthly" ? (
              <>
                <label
                  className={modalStyles.formLabel}
                  htmlFor="deudores-period-month"
                >
                  Mes
                </label>
                <CustomMonthPicker
                  id="deudores-period-month"
                  value={monthValue}
                  onChange={setMonthValue}
                  ariaLabel="Mes del período"
                />
              </>
            ) : period === "custom" ? (
              <>
                <label
                  className={modalStyles.formLabel}
                  htmlFor="deudores-period-from"
                >
                  Desde
                </label>
                <CustomDatePicker
                  value={fromValue}
                  onChange={setFromValue}
                  ariaLabel="Fecha desde"
                  triggerClassName={modalStyles.formDateControl}
                />
                <label
                  className={modalStyles.formLabel}
                  htmlFor="deudores-period-to"
                >
                  Hasta
                </label>
                <CustomDatePicker
                  value={toValue}
                  onChange={setToValue}
                  ariaLabel="Fecha hasta"
                  triggerClassName={modalStyles.formDateControl}
                />
              </>
            ) : (
              <>
                <label
                  className={modalStyles.formLabel}
                  htmlFor="deudores-period-year"
                >
                  Año
                </label>
                <CustomSelect
                  id="deudores-period-year"
                  value={String(year)}
                  onChange={(next) => setYear(Number(next))}
                  ariaLabel="Año del período"
                  options={yearOptions}
                />
              </>
            )}

            {error ? (
              <p className={styles.inlineError} role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div
            className={`${modalStyles.modalActions} ${styles.libroIvaFooter}`}
          >
            <button
              type="button"
              className={styles.invoiceFooterAction}
              onClick={handlePrint}
              disabled={excelBusy}
            >
              <Printer strokeWidth={ICON_STROKE} aria-hidden />
              <span className={styles.invoiceActionLabel}>Imprimir</span>
            </button>
            <button
              type="button"
              className={styles.invoiceFooterAction}
              onClick={handleExcel}
              disabled={excelBusy}
            >
              <FileSpreadsheet strokeWidth={ICON_STROKE} aria-hidden />
              <span className={styles.invoiceActionLabel}>
                {excelBusy ? "Generando…" : "Excel"}
              </span>
            </button>
            <button
              type="button"
              className={styles.invoiceFooterAction}
              onClick={onClose}
              disabled={excelBusy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={modalStyles.modalSaveButton}
              onClick={apply}
              disabled={excelBusy}
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
