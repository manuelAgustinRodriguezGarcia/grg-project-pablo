"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  downloadLibroIvaCustomPdf,
  downloadLibroIvaCustomXlsx,
  downloadLibroIvaPdf,
  downloadLibroIvaXlsx,
  printLibroIvaCustomPdf,
  printLibroIvaPdf,
} from "@/features/billing/utils/invoice-pdf-client";
import {
  parseIsoDateValue,
  parseYearMonthValue,
  toIsoDateValue,
  toYearMonthValue,
  type LibroIvaDailyReportVariant,
} from "@/features/billing/utils/libro-iva";
import { useEscapeToClose } from "@/features/billing/hooks/useBillingModalKeyboard";
import { CustomDatePicker } from "@/shared/components/CustomDatePicker";
import { CustomMonthPicker } from "@/shared/components/CustomMonthPicker";
import { CustomSelect } from "@/shared/components/CustomSelect";
import { Download, FileSpreadsheet, ICON_STROKE, Printer, X } from "@/shared/icons";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

const DAILY_VARIANT_OPTIONS = [
  { value: "simple", label: "Informe Z simple" },
  { value: "detailed", label: "Informe Z detallado" },
] as const;

type LibroIvaDialogProps = {
  onClose: () => void;
};

type LibroIvaPeriod = "monthly" | "daily" | "custom";
type LibroIvaBusy = "pdf" | "print" | "xlsx" | null;

function isCustomRangeValid(fromValue: string, toValue: string): boolean {
  const from = parseIsoDateValue(fromValue);
  const to = parseIsoDateValue(toValue);
  if (!from || !to) {
    return false;
  }

  const fromTime = new Date(from.year, from.month - 1, from.day).getTime();
  const toTime = new Date(to.year, to.month - 1, to.day).getTime();
  return fromTime <= toTime;
}

export function LibroIvaDialog({ onClose }: LibroIvaDialogProps) {
  const [period, setPeriod] = useState<LibroIvaPeriod>("monthly");
  const [dailyVariant, setDailyVariant] =
    useState<LibroIvaDailyReportVariant>("simple");
  const [monthValue, setMonthValue] = useState(toYearMonthValue());
  const [dayValue, setDayValue] = useState(toIsoDateValue());
  const [fromValue, setFromValue] = useState(toIsoDateValue());
  const [toValue, setToValue] = useState(toIsoDateValue());
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<LibroIvaBusy>(null);
  const isBusy = busyAction !== null;

  const monthly = parseYearMonthValue(monthValue);
  const daily = parseIsoDateValue(dayValue);
  const customFrom = parseIsoDateValue(fromValue);
  const customTo = parseIsoDateValue(toValue);
  const customValid = isCustomRangeValid(fromValue, toValue);
  const canRun =
    period === "monthly"
      ? monthly !== null
      : period === "daily"
        ? daily !== null
        : customValid;

  useEscapeToClose(onClose, !isBusy);

  async function runMonthlyOrDaily(
    action: Exclude<LibroIvaBusy, null>,
    task: (
      year: number,
      month: number,
      day?: number,
      variant?: LibroIvaDailyReportVariant,
    ) => Promise<void>,
  ): Promise<void> {
    if (period === "monthly") {
      if (!monthly) {
        setError("Indicá un mes válido.");
        return;
      }
      setBusyAction(action);
      setError(null);
      try {
        await task(monthly.year, monthly.month);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudo generar el Libro IVA.",
        );
      } finally {
        setBusyAction(null);
      }
      return;
    }

    if (!daily) {
      setError("Indicá un día válido.");
      return;
    }

    setBusyAction(action);
    setError(null);
    try {
      await task(daily.year, daily.month, daily.day, dailyVariant);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo generar el Libro IVA.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function runCustom(
    action: Exclude<LibroIvaBusy, null>,
    task: (from: string, to: string) => Promise<void>,
  ): Promise<void> {
    if (!customFrom || !customTo) {
      setError("Indicá un rango de fechas válido.");
      return;
    }
    if (!customValid) {
      setError("La fecha desde no puede ser posterior a la fecha hasta.");
      return;
    }

    setBusyAction(action);
    setError(null);
    try {
      await task(fromValue, toValue);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo generar el Libro IVA.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  const periodLabel =
    period === "monthly" && monthly
      ? new Intl.DateTimeFormat("es-AR", {
          month: "long",
          year: "numeric",
        }).format(new Date(monthly.year, monthly.month - 1, 1))
      : period === "daily" && daily
        ? new Intl.DateTimeFormat("es-AR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          }).format(new Date(daily.year, daily.month - 1, daily.day))
        : period === "custom" && customFrom && customTo
          ? `${new Intl.DateTimeFormat("es-AR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            }).format(
              new Date(customFrom.year, customFrom.month - 1, customFrom.day),
            )} – ${new Intl.DateTimeFormat("es-AR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            }).format(new Date(customTo.year, customTo.month - 1, customTo.day))}`
          : "";

  const subtitle =
    period === "monthly"
      ? `PDF y Excel de ${periodLabel || "el mes elegido"}, con Facturas A y B en hojas separadas. Incluye notas de crédito (restan) y de débito (suman). No incluye Recibos.`
      : period === "custom"
        ? `PDF y Excel del período ${periodLabel || "elegido"}, con Facturas A y B en hojas separadas. Incluye notas de crédito (restan) y de débito (suman). No incluye Recibos.`
        : dailyVariant === "simple"
          ? `Informe Z simple del día ${periodLabel || "elegido"}: totales de ventas y de notas de crédito/débito.`
          : `Informe Z detallado del día ${periodLabel || "elegido"}: comprobante inicial y final por tipo (Facturas, NC y ND).`;

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`${modalStyles.modalOverlay} ${styles.receiptFormOverlay}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          onClose();
        }
      }}
    >
      <div
        className={`${modalStyles.modalCard} ${styles.libroIvaCard}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="libro-iva-title"
      >
        <header className={styles.invoiceDetailHeader}>
          <div>
            <h2 id="libro-iva-title" className={styles.invoiceDetailTitle}>
              Libro IVA
            </h2>
            <p className={styles.invoiceDetailSubtitle}>{subtitle}</p>
          </div>
          <button
            type="button"
            className={styles.invoiceDetailClose}
            onClick={onClose}
            disabled={isBusy}
            aria-label="Cerrar"
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </header>

        <div className={styles.libroIvaSheet}>
          <div className={styles.libroIvaFields}>
            <div className={styles.libroIvaPeriodToggle} role="radiogroup" aria-label="Tipo de libro">
              <button
                type="button"
                role="radio"
                aria-checked={period === "monthly"}
                className={`${styles.libroIvaPeriodButton} ${
                  period === "monthly" ? styles.libroIvaPeriodButtonActive : ""
                }`}
                onClick={() => setPeriod("monthly")}
                disabled={isBusy}
              >
                Mensual
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={period === "daily"}
                className={`${styles.libroIvaPeriodButton} ${
                  period === "daily" ? styles.libroIvaPeriodButtonActive : ""
                }`}
                onClick={() => setPeriod("daily")}
                disabled={isBusy}
              >
                Diario
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={period === "custom"}
                className={`${styles.libroIvaPeriodButton} ${
                  period === "custom" ? styles.libroIvaPeriodButtonActive : ""
                }`}
                onClick={() => setPeriod("custom")}
                disabled={isBusy}
              >
                Personalizado
              </button>
            </div>

            {period === "monthly" ? (
              <>
                <label className={modalStyles.formLabel} htmlFor="libro-iva-month">
                  Mes
                </label>
                <CustomMonthPicker
                  id="libro-iva-month"
                  value={monthValue}
                  onChange={setMonthValue}
                  disabled={isBusy}
                  ariaLabel="Mes del Libro IVA"
                />
              </>
            ) : period === "daily" ? (
              <>
                <label className={modalStyles.formLabel} htmlFor="libro-iva-variant">
                  Informe
                </label>
                <CustomSelect
                  id="libro-iva-variant"
                  value={dailyVariant}
                  onChange={(next) => {
                    setDailyVariant(next === "detailed" ? "detailed" : "simple");
                  }}
                  disabled={isBusy}
                  ariaLabel="Tipo de informe Z"
                  options={[...DAILY_VARIANT_OPTIONS]}
                />
                <label className={modalStyles.formLabel} htmlFor="libro-iva-day">
                  Día
                </label>
                <CustomDatePicker
                  value={dayValue}
                  onChange={setDayValue}
                  disabled={isBusy}
                  ariaLabel="Día del Libro IVA"
                  triggerClassName={modalStyles.formDateControl}
                />
              </>
            ) : (
              <>
                <label className={modalStyles.formLabel} htmlFor="libro-iva-from">
                  Desde
                </label>
                <CustomDatePicker
                  value={fromValue}
                  onChange={setFromValue}
                  disabled={isBusy}
                  ariaLabel="Fecha desde del Libro IVA"
                  triggerClassName={modalStyles.formDateControl}
                />
                <label className={modalStyles.formLabel} htmlFor="libro-iva-to">
                  Hasta
                </label>
                <CustomDatePicker
                  value={toValue}
                  onChange={setToValue}
                  disabled={isBusy}
                  ariaLabel="Fecha hasta del Libro IVA"
                  triggerClassName={modalStyles.formDateControl}
                />
              </>
            )}

            {error ? (
              <p className={styles.inlineError} role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className={`${modalStyles.modalActions} ${styles.libroIvaFooter}`}>
            <button
              type="button"
              className={styles.invoiceFooterAction}
              onClick={() => {
                if (period === "custom") {
                  void runCustom("print", printLibroIvaCustomPdf);
                  return;
                }
                void runMonthlyOrDaily("print", printLibroIvaPdf);
              }}
              disabled={isBusy || !canRun}
            >
              <Printer strokeWidth={ICON_STROKE} aria-hidden />
              <span className={styles.invoiceActionLabel}>
                {busyAction === "print" ? "Abriendo…" : "Imprimir"}
              </span>
            </button>
            <button
              type="button"
              className={styles.invoiceFooterAction}
              onClick={() => {
                if (period === "custom") {
                  void runCustom("xlsx", downloadLibroIvaCustomXlsx);
                  return;
                }
                void runMonthlyOrDaily("xlsx", downloadLibroIvaXlsx);
              }}
              disabled={isBusy || !canRun}
            >
              <FileSpreadsheet strokeWidth={ICON_STROKE} aria-hidden />
              <span className={styles.invoiceActionLabel}>
                {busyAction === "xlsx" ? "Generando…" : "Excel"}
              </span>
            </button>
            <button
              type="button"
              className={modalStyles.modalSaveButton}
              onClick={() => {
                if (period === "custom") {
                  void runCustom("pdf", downloadLibroIvaCustomPdf);
                  return;
                }
                void runMonthlyOrDaily("pdf", downloadLibroIvaPdf);
              }}
              disabled={isBusy || !canRun}
            >
              <Download strokeWidth={ICON_STROKE} aria-hidden />
              {busyAction === "pdf" ? "Generando…" : "Descargar PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
