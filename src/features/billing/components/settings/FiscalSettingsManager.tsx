"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useReportAdminSectionReady } from "@/features/admin/components/AdminSectionTransition";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import {
  getBillingFiscalSettingsAction,
  updateBillingGenericClientLimitAction,
  updateBillingIssuerFiscalSettingsAction,
  updateBillingIvaPercentAction,
} from "@/features/billing/actions/billing-fiscal-settings.actions";
import { updateIssuerFiscalSettingsSchema } from "@/features/billing/schemas/billing-fiscal-settings.schemas";
import type {
  BillingFiscalContext,
  BillingInvoiceActionResult,
} from "@/features/billing/types/billing-invoice.types";
import { FISCAL_ENVIRONMENT_LABELS } from "@/features/billing/types/billing-invoice.types";
import { PRODUCTION_EMISSION_DISABLED_MESSAGE } from "@/shared/fiscal/production-emission";
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
import {
  formatActivitiesStartedAt,
  getIssuerFiscalConfigurationStatus,
  ISSUER_FISCAL_FIELD_LABELS,
} from "@/features/billing/utils/issuer-fiscal-configuration";
import { centsToPesos, pesosToCents } from "@/shared/utils/billing-invoice-totals";
import { formatCuit } from "@/shared/utils/identification";
import { Building2, Cog, ICON_STROKE, Percent, Wallet } from "@/shared/icons";
import styles from "@/features/billing/styles/FiscalSettings.module.scss";

type FiscalSettingsManagerProps = {
  initialSettings: BillingFiscalContext;
  canUpdateSettings?: boolean;
};

type IssuerForm = {
  issuerName: string;
  issuerCuit: string;
  issuerAddress: string;
  issuerCity: string;
  issuerProvince: string;
  issuerIvaCondition: string;
  issuerGrossIncome: string;
  issuerActivitiesStartedAt: string;
};

type PendingChange =
  | { kind: "iva"; nextValue: number }
  | { kind: "limit"; nextValue: number }
  | { kind: "issuer"; nextValue: IssuerForm };

function issuerFormFromSettings(settings: BillingFiscalContext): IssuerForm {
  return {
    issuerName: settings.issuerName ?? "",
    issuerCuit: settings.issuerCuit ? formatCuit(settings.issuerCuit) : "",
    issuerAddress: settings.issuerAddress ?? "",
    issuerCity: settings.issuerCity ?? "",
    issuerProvince: settings.issuerProvince ?? "",
    issuerIvaCondition: settings.issuerIvaCondition ?? "",
    issuerGrossIncome: settings.issuerGrossIncome ?? "",
    issuerActivitiesStartedAt: formatActivitiesStartedAt(
      settings.issuerActivitiesStartedAt,
    ),
  };
}

function environmentHint(settings: BillingFiscalContext): string {
  switch (settings.environment) {
    case "MODO_PRUEBA":
      return "Numeración interna. Los comprobantes no se envían a ARCA.";
    case "HOMOLOGACION":
      return "Ambiente de prueba de ARCA. No tiene validez fiscal de producción.";
    case "PRODUCCION":
      return settings.productionEmissionEnabled
        ? "Los comprobantes se emiten en ARCA y tienen validez fiscal."
        : PRODUCTION_EMISSION_DISABLED_MESSAGE;
    default: {
      const unexpected: never = settings.environment;
      return unexpected;
    }
  }
}

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
  canUpdateSettings = false,
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
  const [issuerForm, setIssuerForm] = useState(() =>
    issuerFormFromSettings(settings),
  );
  const [issuerError, setIssuerError] = useState<string | null>(null);
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
      case "issuer":
        return {
          title: "Guardar datos del emisor",
          message: (
            <>
              Está por guardar la razón social, el CUIT y el domicilio fiscal
              del emisor. El CUIT se usa en las próximas emisiones.
              <br />
              <br />
              ¿Desea continuar?
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

  function requestIssuerUpdate() {
    setIssuerError(null);
    const parsed = updateIssuerFiscalSettingsSchema.safeParse(issuerForm);

    if (!parsed.success) {
      setIssuerError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
      return;
    }

    setPending({ kind: "issuer", nextValue: parsed.data });
  }

  const issuerStatus = getIssuerFiscalConfigurationStatus(settings);

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
        case "issuer":
          result = await updateBillingIssuerFiscalSettingsAction(
            pending.nextValue,
          );
          break;
        default: {
          const _exhaustive: never = pending;
          throw new Error(`Unhandled settings change: ${_exhaustive}`);
        }
      }

      if (!result.success) {
        switch (pending.kind) {
          case "iva":
            setIvaError(result.error);
            break;
          case "limit":
            setLimitError(result.error);
            break;
          case "issuer":
            setIssuerError(result.error);
            break;
          default: {
            const unexpected: never = pending;
            throw new Error(`Unhandled settings change: ${unexpected}`);
          }
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
      setIssuerForm(issuerFormFromSettings(result.data));
      setIssuerError(null);
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
            IVA, límite de cliente genérico y datos fiscales del emisor.
          </p>
        </header>

        {issuerStatus.complete ? null : (
          <p className={styles.warning} role="status">
            Faltan datos fiscales del emisor para habilitar producción.
            {issuerStatus.missingFields.length > 0
              ? ` ${issuerStatus.missingFields
                  .map((field) => ISSUER_FISCAL_FIELD_LABELS[field])
                  .join(", ")}.`
              : null}
          </p>
        )}

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
            {canUpdateSettings ? (
              <>
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
              </>
            ) : null}
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
            {canUpdateSettings ? (
              <>
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
              </>
            ) : null}
          </section>

          <section
            className={`${styles.card} ${styles.wideCard}`}
            aria-labelledby="issuer-settings-title"
          >
            <div className={styles.cardHeading}>
              <span className={styles.cardIcon} aria-hidden>
                <Building2 strokeWidth={ICON_STROKE} />
              </span>
              <div>
                <h3 id="issuer-settings-title" className={styles.cardTitle}>
                  Datos del emisor
                </h3>
                <p className={styles.cardHint}>
                  Aparecen en el PDF fiscal. El CUIT se guarda sin guiones y se
                  muestra como XX-XXXXXXXX-X.
                </p>
              </div>
            </div>
            <div className={styles.formGrid}>
              <IssuerField
                id="issuer-name"
                label="Razón social"
                value={issuerForm.issuerName}
                readOnly={!canUpdateSettings}
                onChange={(value) =>
                  setIssuerForm((current) => ({ ...current, issuerName: value }))
                }
              />
              <IssuerField
                id="issuer-cuit"
                label="CUIT"
                value={issuerForm.issuerCuit}
                readOnly={!canUpdateSettings}
                onChange={(value) =>
                  setIssuerForm((current) => ({ ...current, issuerCuit: value }))
                }
                onBlur={() =>
                  setIssuerForm((current) => ({
                    ...current,
                    issuerCuit: current.issuerCuit
                      ? formatCuit(current.issuerCuit)
                      : "",
                  }))
                }
              />
              <IssuerField
                id="issuer-address"
                label="Domicilio comercial"
                value={issuerForm.issuerAddress}
                readOnly={!canUpdateSettings}
                onChange={(value) =>
                  setIssuerForm((current) => ({
                    ...current,
                    issuerAddress: value,
                  }))
                }
              />
              <IssuerField
                id="issuer-city"
                label="Localidad"
                value={issuerForm.issuerCity}
                readOnly={!canUpdateSettings}
                onChange={(value) =>
                  setIssuerForm((current) => ({ ...current, issuerCity: value }))
                }
              />
              <IssuerField
                id="issuer-province"
                label="Provincia"
                value={issuerForm.issuerProvince}
                readOnly={!canUpdateSettings}
                onChange={(value) =>
                  setIssuerForm((current) => ({
                    ...current,
                    issuerProvince: value,
                  }))
                }
              />
              <IssuerField
                id="issuer-iva"
                label="Condición frente al IVA"
                value={issuerForm.issuerIvaCondition}
                readOnly={!canUpdateSettings}
                onChange={(value) =>
                  setIssuerForm((current) => ({
                    ...current,
                    issuerIvaCondition: value,
                  }))
                }
              />
              <IssuerField
                id="issuer-gross-income"
                label="Ingresos Brutos"
                value={issuerForm.issuerGrossIncome}
                readOnly={!canUpdateSettings}
                onChange={(value) =>
                  setIssuerForm((current) => ({
                    ...current,
                    issuerGrossIncome: value,
                  }))
                }
              />
              <IssuerField
                id="issuer-activities-started"
                label="Inicio de actividades"
                placeholder="DD/MM/AAAA"
                value={issuerForm.issuerActivitiesStartedAt}
                readOnly={!canUpdateSettings}
                onChange={(value) =>
                  setIssuerForm((current) => ({
                    ...current,
                    issuerActivitiesStartedAt: value,
                  }))
                }
              />
            </div>
            {issuerError ? <p className={styles.error}>{issuerError}</p> : null}
            {canUpdateSettings ? (
              <button
                type="button"
                className={styles.submit}
                onClick={requestIssuerUpdate}
                disabled={isBusy}
              >
                Guardar datos del emisor
              </button>
            ) : null}
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
                  Punto de venta y ambiente usados al emitir.
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
              {environmentHint(settings)}
            </p>
          </section>
        </div>
      </div>

      {canUpdateSettings && pending && confirmCopy ? (
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

function IssuerField({
  id,
  label,
  value,
  onChange,
  onBlur,
  readOnly,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  readOnly: boolean;
  placeholder?: string;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}
