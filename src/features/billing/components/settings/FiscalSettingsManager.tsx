"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useReportAdminSectionReady } from "@/features/admin/components/AdminSectionTransition";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import {
  getBillingFiscalSettingsAction,
  updateBillingGenericClientLimitAction,
  updateBillingIvaPercentAction,
} from "@/features/billing/actions/billing-fiscal-settings.actions";
import type {
  BillingFiscalContext,
  BillingInvoiceActionResult,
} from "@/features/billing/types/billing-invoice.types";
import { FISCAL_ENVIRONMENT_LABELS } from "@/features/billing/types/billing-invoice.types";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import {
  formatIvaPercent,
  parseIvaPercentInput,
} from "@/features/billing/utils/fiscal-settings";
import {
  formatPesosInput,
  maskPesosInput,
  parsePesosInput,
} from "@/features/billing/utils/receipt-allocation";
import { centsToPesos, pesosToCents } from "@/shared/utils/billing-invoice-totals";
import { Cog, ICON_STROKE, Percent, Wallet } from "@/shared/icons";
import styles from "@/features/billing/styles/FiscalSettings.module.scss";

type FiscalSettingsManagerProps = {
  initialSettings: BillingFiscalContext;
};

type PendingChange =
  | { kind: "iva"; nextValue: number }
  | { kind: "limit"; nextValue: number };

function environmentLabel(environment: BillingFiscalContext["environment"]): string {
  switch (environment) {
    case "MODO_PRUEBA":
    case "HOMOLOGACION":
    case "PRODUCCION":
      return FISCAL_ENVIRONMENT_LABELS[environment];
    default: {
      const _exhaustive: never = environment;
      return _exhaustive;
    }
  }
}

export function FiscalSettingsManager({
  initialSettings,
}: FiscalSettingsManagerProps) {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: adminQueryKeys.billingFiscalSettings(),
    queryFn: async (): Promise<BillingFiscalContext> => {
      const result = await getBillingFiscalSettingsAction();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    initialData: initialSettings,
    staleTime: 30_000,
  });

  const settings = settingsQuery.data ?? initialSettings;
  const [ivaInput, setIvaInput] = useState(formatIvaPercent(settings.ivaPercent));
  const [limitInput, setLimitInput] = useState(
    formatPesosInput(pesosToCents(settings.genericClientLimit)),
  );
  const [ivaError, setIvaError] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const parsedIva = parseIvaPercentInput(ivaInput);
  const parsedLimitCents = parsePesosInput(limitInput);
  const parsedLimit =
    parsedLimitCents === null ? null : centsToPesos(parsedLimitCents);

  const ivaChanged =
    parsedIva !== null && parsedIva !== settings.ivaPercent;
  const limitChanged =
    parsedLimit !== null && parsedLimit !== settings.genericClientLimit;

  const confirmCopy = useMemo(() => {
    if (!pending) {
      return null;
    }

    switch (pending.kind) {
      case "iva":
        return {
          title: "Modificar IVA",
          message: (
            <>
              Está por modificar el valor del IVA.
              <br />
              Valor actual: {formatIvaPercent(settings.ivaPercent)}%
              <br />
              Nuevo valor: {formatIvaPercent(pending.nextValue)}%
              <br />
              <br />
              Esta acción puede afectar los cálculos de las próximas facturas.
              ¿Desea continuar?
            </>
          ),
        };
      case "limit":
        return {
          title: "Modificar límite de cliente genérico",
          message: (
            <>
              Está por modificar el límite de facturación a cliente genérico.
              <br />
              Valor actual: {formatArsExact(settings.genericClientLimit)}
              <br />
              Nuevo valor: {formatArsExact(pending.nextValue)}
              <br />
              <br />
              Esta acción aplica a las próximas facturas. ¿Desea continuar?
            </>
          ),
        };
      default: {
        const _exhaustive: never = pending;
        return _exhaustive;
      }
    }
  }, [pending, settings.genericClientLimit, settings.ivaPercent]);

  useReportAdminSectionReady(true);

  function requestIvaUpdate() {
    setIvaError(null);
    if (parsedIva === null) {
      setIvaError("Indicá un porcentaje de IVA válido.");
      return;
    }

    setPending({ kind: "iva", nextValue: parsedIva });
  }

  function requestLimitUpdate() {
    setLimitError(null);
    if (parsedLimit === null) {
      setLimitError("Indicá un límite válido.");
      return;
    }

    setPending({ kind: "limit", nextValue: parsedLimit });
  }

  async function persistPending() {
    if (!pending) {
      return;
    }

    setIsBusy(true);

    try {
      let result: BillingInvoiceActionResult<BillingFiscalContext>;
      switch (pending.kind) {
        case "iva":
          result = await updateBillingIvaPercentAction({
            ivaPercent: pending.nextValue,
          });
          break;
        case "limit":
          result = await updateBillingGenericClientLimitAction({
            genericClientLimit: pending.nextValue,
          });
          break;
        default: {
          const _exhaustive: never = pending;
          throw new Error(`Unhandled settings change: ${_exhaustive}`);
        }
      }

      if (!result.success) {
        if (pending.kind === "iva") {
          setIvaError(result.error);
        } else {
          setLimitError(result.error);
        }
        return;
      }

      queryClient.setQueryData(
        adminQueryKeys.billingFiscalSettings(),
        result.data,
      );
      setIvaInput(formatIvaPercent(result.data.ivaPercent));
      setLimitInput(
        formatPesosInput(pesosToCents(result.data.genericClientLimit)),
      );
      setPending(null);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <div className={styles.page}>
        <header className={styles.header}>
          <h2 className={styles.title}>Configuración fiscal</h2>
          <p className={styles.subtitle}>
            IVA vigente y límite para cliente genérico. La conexión con ARCA se
            configura más adelante.
          </p>
        </header>

        <div className={styles.grid}>
          <section className={styles.card} aria-labelledby="iva-settings-title">
            <div className={styles.cardHeading}>
              <span className={styles.cardIcon} aria-hidden>
                <Percent strokeWidth={ICON_STROKE} />
              </span>
              <div>
                <h3 id="iva-settings-title" className={styles.cardTitle}>
                  IVA vigente
                </h3>
                <p className={styles.cardHint}>
                  Se usa al crear facturas nuevas. Las ya emitidas no cambian.
                </p>
              </div>
            </div>
            <p className={styles.currentValue}>
              {formatIvaPercent(settings.ivaPercent)}%
            </p>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="iva-percent-input">
                Nuevo porcentaje
              </label>
              <div className={styles.inputWrap}>
                <input
                  id="iva-percent-input"
                  className={styles.input}
                  type="text"
                  inputMode="decimal"
                  value={ivaInput}
                  onChange={(event) => {
                    setIvaInput(event.target.value);
                    setIvaError(null);
                  }}
                  aria-invalid={Boolean(ivaError)}
                />
                <span className={styles.suffix}>%</span>
              </div>
            </div>
            {ivaError ? <p className={styles.error}>{ivaError}</p> : null}
            <button
              type="button"
              className={styles.submit}
              onClick={requestIvaUpdate}
              disabled={!ivaChanged || isBusy}
            >
              Actualizar IVA
            </button>
          </section>

          <section
            className={styles.card}
            aria-labelledby="generic-limit-title"
          >
            <div className={styles.cardHeading}>
              <span className={styles.cardIcon} aria-hidden>
                <Wallet strokeWidth={ICON_STROKE} />
              </span>
              <div>
                <h3 id="generic-limit-title" className={styles.cardTitle}>
                  Límite de cliente genérico
                </h3>
                <p className={styles.cardHint}>
                  Tope para facturar a un cliente sin CUIT ni DNI.
                </p>
              </div>
            </div>
            <p className={styles.currentValue}>
              {formatArsExact(settings.genericClientLimit)}
            </p>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="generic-limit-input">
                Nuevo límite
              </label>
              <div className={styles.inputWrap}>
                <input
                  id="generic-limit-input"
                  className={styles.input}
                  type="text"
                  inputMode="decimal"
                  value={limitInput}
                  onChange={(event) => {
                    setLimitInput(maskPesosInput(event.target.value));
                    setLimitError(null);
                  }}
                  aria-invalid={Boolean(limitError)}
                />
              </div>
            </div>
            {limitError ? <p className={styles.error}>{limitError}</p> : null}
            <button
              type="button"
              className={styles.submit}
              onClick={requestLimitUpdate}
              disabled={!limitChanged || isBusy}
            >
              Actualizar límite
            </button>
          </section>

          <section
            className={`${styles.card} ${styles.wideCard}`}
            aria-labelledby="fiscal-context-title"
          >
            <div className={styles.cardHeading}>
              <span className={styles.cardIcon} aria-hidden>
                <Cog strokeWidth={ICON_STROKE} />
              </span>
              <div>
                <h3 id="fiscal-context-title" className={styles.cardTitle}>
                  Ambiente actual
                </h3>
                <p className={styles.cardHint}>
                  Datos de emisión usados en modo prueba. Certificados y CAE
                  quedan para la etapa ARCA.
                </p>
              </div>
            </div>
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Punto de venta</span>
                <span className={styles.metaValue}>{settings.pointOfSale}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Ambiente</span>
                <span className={styles.metaValue}>
                  {environmentLabel(settings.environment)}
                </span>
              </div>
            </div>
            <p className={styles.metaNote}>
              Los comprobantes se numeran internamente y no se envían a ARCA.
            </p>
          </section>
        </div>
      </div>

      {pending && confirmCopy ? (
        <ConfirmDialog
          title={confirmCopy.title}
          message={confirmCopy.message}
          confirmLabel="Confirmar cambio"
          isBusy={isBusy}
          onConfirm={() => void persistPending()}
          onCancel={() => {
            if (!isBusy) {
              setPending(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
