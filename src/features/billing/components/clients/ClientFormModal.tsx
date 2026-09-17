"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type {
  BillingIdentificationType,
  BillingIvaCondition,
} from "@/generated/prisma/client";
import type { BillingClientListItem } from "@/features/billing/types/billing-client.types";
import {
  IDENTIFICATION_TYPE_LABELS,
  IVA_CONDITION_LABELS,
  IVA_CONDITION_ORDER,
  IVA_CONDITION_SHORT_LABELS,
} from "@/features/billing/types/billing-client.types";
import { CustomSelect } from "@/shared/components/CustomSelect";
import { ARGENTINE_PROVINCES, isArgentineProvince } from "@/shared/utils/argentine-provinces";
import {
  isValidCuit,
  isValidDni,
  normalizeIdentificationDigits,
} from "@/shared/utils/identification";
import { AlertTriangle, ICON_STROKE, X } from "@/shared/icons";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";
import wizardStyles from "@/features/imports/components/ImportWizard.module.scss";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

const IDENTIFICATION_OPTIONS: {
  value: BillingIdentificationType;
  label: string;
}[] = [
  { value: "CUIT", label: "CUIT" },
  { value: "DNI", label: "DNI" },
  { value: "NINGUNO", label: "Nada" },
];

export type ClientFormValues = {
  name: string;
  code: string;
  address: string;
  city: string;
  province: string;
  email: string;
  whatsapp: string;
  identificationType: BillingIdentificationType;
  identificationNumber: string;
  ivaCondition: BillingIvaCondition;
  notes: string;
};

type ClientFormModalProps = {
  mode: "create" | "edit";
  initialClient?: BillingClientListItem | null;
  isBusy: boolean;
  error: string | null;
  onClearError: () => void;
  onClose: () => void;
  onSubmit: (values: ClientFormValues) => void;
};

export function ClientFormModal({
  mode,
  initialClient,
  isBusy,
  error,
  onClearError,
  onClose,
  onSubmit,
}: ClientFormModalProps) {
  const [name, setName] = useState(initialClient?.name ?? "");
  const [code, setCode] = useState(initialClient?.code ?? "");
  const [address, setAddress] = useState(initialClient?.address ?? "");
  const [city, setCity] = useState(initialClient?.city ?? "");
  const [province, setProvince] = useState(initialClient?.province ?? "");
  const [email, setEmail] = useState(initialClient?.email ?? "");
  const [whatsapp, setWhatsapp] = useState(initialClient?.whatsapp ?? "");
  const [identificationType, setIdentificationType] =
    useState<BillingIdentificationType>(
      initialClient?.identificationType ?? "NINGUNO",
    );
  const [identificationNumber, setIdentificationNumber] = useState(
    initialClient?.identificationNumber ?? "",
  );
  const [ivaCondition, setIvaCondition] = useState<BillingIvaCondition>(
    initialClient?.ivaCondition ?? "CONSUMIDOR_FINAL",
  );
  const [notes, setNotes] = useState(initialClient?.notes ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const [provinceError, setProvinceError] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const isDirty =
    name !== (initialClient?.name ?? "") ||
    code !== (initialClient?.code ?? "") ||
    address !== (initialClient?.address ?? "") ||
    city !== (initialClient?.city ?? "") ||
    province !== (initialClient?.province ?? "") ||
    email !== (initialClient?.email ?? "") ||
    whatsapp !== (initialClient?.whatsapp ?? "") ||
    identificationType !== (initialClient?.identificationType ?? "NINGUNO") ||
    identificationNumber !== (initialClient?.identificationNumber ?? "") ||
    ivaCondition !== (initialClient?.ivaCondition ?? "CONSUMIDOR_FINAL") ||
    notes !== (initialClient?.notes ?? "");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || isBusy) {
        return;
      }

      if (showDiscardConfirm) {
        setShowDiscardConfirm(false);
        return;
      }

      if (isDirty) {
        setShowDiscardConfirm(true);
        return;
      }

      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, isDirty, showDiscardConfirm, onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  const isCuit = identificationType === "CUIT";
  const showDocumentInput = identificationType !== "NINGUNO";

  function requestClose() {
    if (isBusy) {
      return;
    }

    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }

    onClose();
  }

  function clearVisibleError() {
    setLocalError(null);
    setProvinceError(null);
    onClearError();
  }

  function handleIdentificationTypeChange(next: BillingIdentificationType) {
    if (next === identificationType) {
      return;
    }

    setIdentificationType(next);
    setIdentificationNumber("");
    clearVisibleError();

    if (next !== "CUIT") {
      setIvaCondition("CONSUMIDOR_FINAL");
    }
  }

  function handleIdentificationNumberChange(value: string) {
    setIdentificationNumber(value.replace(isCuit ? /[^\d-]/g : /\D/g, ""));
    clearVisibleError();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLocalError(null);

    if (identificationType === "CUIT") {
      const digits = normalizeIdentificationDigits(identificationNumber);

      if (digits.length !== 11) {
        setLocalError("El CUIT debe tener 11 dígitos numéricos.");
        return;
      }

      if (!isValidCuit(digits)) {
        setLocalError(
          "El CUIT no es válido: el dígito verificador no coincide.",
        );
        return;
      }
    }

    if (identificationType === "DNI") {
      const digits = normalizeIdentificationDigits(identificationNumber);

      if (!isValidDni(digits)) {
        setLocalError("El DNI debe tener 7 u 8 dígitos numéricos.");
        return;
      }
    }

    if (mode === "edit") {
      const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, "");
      if (!/^[A-Z0-9]{2,10}-\d{1,8}$/.test(normalizedCode)) {
        setLocalError(
          "El código debe tener el formato LETRAS-00000, por ejemplo GLR-00002.",
        );
        return;
      }
    }

    if (!isArgentineProvince(province)) {
      const message = "Falta seleccionar una provincia.";
      setProvinceError(message);
      setLocalError(message);
      return;
    }

    onSubmit({
      name: name.trim().toLocaleUpperCase("es-AR"),
      code: code.trim().toLocaleUpperCase("es-AR"),
      address: address.trim(),
      city: city.trim(),
      province: province.trim(),
      email: email.trim(),
      whatsapp: whatsapp.trim(),
      identificationType,
      identificationNumber:
        identificationType === "NINGUNO"
          ? ""
          : normalizeIdentificationDigits(identificationNumber),
      ivaCondition: isCuit ? ivaCondition : "CONSUMIDOR_FINAL",
      notes: notes.trim(),
    });
  }

  const title = mode === "create" ? "Nuevo cliente" : "Editar cliente";
  const subtitle =
    mode === "create"
      ? "Cargue los datos del cliente para usarlo en la facturación."
      : `Actualice los datos del cliente ${initialClient?.code ?? ""}.`;
  const visibleError = localError ?? error;

  return createPortal(
    <div
      className={modalStyles.modalOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        className={`${modalStyles.modalCard} ${styles.formModalCard}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-form-title"
      >
        <div className={modalStyles.modalHeader}>
          <div className={modalStyles.modalHeaderText}>
            <h2 id="client-form-title" className={modalStyles.modalTitle}>
              {title}
            </h2>
            <p className={modalStyles.modalSubtitle}>{subtitle}</p>
          </div>
          <button
            type="button"
            className={modalStyles.modalCloseButton}
            onClick={requestClose}
            disabled={isBusy}
            aria-label="Cerrar"
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formColumns}>
            <section
              className={styles.formColumn}
              aria-label="Datos del cliente"
            >
              <h3 className={styles.formSectionTitle}>Datos del cliente</h3>

              {mode === "edit" ? (
                <div className={modalStyles.formField}>
                  <label
                    className={modalStyles.formLabel}
                    htmlFor="client-code"
                  >
                    Código de cliente
                  </label>
                  <input
                    id="client-code"
                    className={`${modalStyles.formInput} ${styles.uppercaseInput}`}
                    value={code}
                    onChange={(event) =>
                      setCode(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9-]/g, ""),
                      )
                    }
                    placeholder="GLR-00002"
                    maxLength={24}
                    required
                    disabled={isBusy}
                  />
                  <p className={styles.formHint}>
                    Formato: iniciales y número de 5 dígitos, por ejemplo
                    GLR-00002.
                  </p>
                </div>
              ) : null}

              <div className={modalStyles.formField}>
                <label
                  className={modalStyles.formLabel}
                  htmlFor="client-name"
                >
                  Nombre o razón social
                </label>
                <input
                  id="client-name"
                  className={`${modalStyles.formInput} ${styles.uppercaseInput}`}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="TRANSPORTES DEL SUR S.A."
                  maxLength={160}
                  required
                  autoFocus={mode === "create"}
                  disabled={isBusy}
                />
              </div>

              <div className={modalStyles.formField}>
                <label
                  className={modalStyles.formLabel}
                  htmlFor="client-address"
                >
                  Dirección
                </label>
                <input
                  id="client-address"
                  className={modalStyles.formInput}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Av. San Martín 1234"
                  maxLength={160}
                  disabled={isBusy}
                />
              </div>

              <div className={styles.formGrid}>
                <div className={modalStyles.formField}>
                  <label
                    className={modalStyles.formLabel}
                    htmlFor="client-city"
                  >
                    Localidad
                  </label>
                  <input
                    id="client-city"
                    className={modalStyles.formInput}
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="Rafaela"
                    maxLength={160}
                    disabled={isBusy}
                  />
                </div>

                <div className={modalStyles.formField}>
                  <label
                    className={modalStyles.formLabel}
                    htmlFor="client-province"
                  >
                    Provincia
                  </label>
                  <CustomSelect
                    id="client-province"
                    value={province}
                    placeholder="Buscar o seleccionar provincia"
                    ariaLabel="Provincia"
                    disabled={isBusy}
                    searchable
                    invalid={Boolean(provinceError)}
                    emptyText="No hay provincias con esa búsqueda."
                    options={ARGENTINE_PROVINCES.map((name) => ({
                      value: name,
                      label: name,
                    }))}
                    onChange={(value) => {
                      setProvince(value);
                      setProvinceError(null);
                      setLocalError(null);
                      onClearError();
                    }}
                  />
                  {provinceError ? (
                    <p className={modalStyles.formError} role="alert">
                      {provinceError}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={modalStyles.formField}>
                  <label
                    className={modalStyles.formLabel}
                    htmlFor="client-email"
                  >
                    Email (opcional)
                  </label>
                  <input
                    id="client-email"
                    type="email"
                    className={modalStyles.formInput}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="cliente@correo.com"
                    maxLength={160}
                    disabled={isBusy}
                  />
                </div>

                <div className={modalStyles.formField}>
                  <label
                    className={modalStyles.formLabel}
                    htmlFor="client-whatsapp"
                  >
                    WhatsApp (opcional)
                  </label>
                  <input
                    id="client-whatsapp"
                    type="tel"
                    className={modalStyles.formInput}
                    value={whatsapp}
                    onChange={(event) => setWhatsapp(event.target.value)}
                    placeholder="3492 123456"
                    maxLength={30}
                    disabled={isBusy}
                  />
                </div>
              </div>

              <div className={modalStyles.formField}>
                <label
                  className={modalStyles.formLabel}
                  htmlFor="client-notes"
                >
                  Observaciones (opcional)
                </label>
                <textarea
                  id="client-notes"
                  className={`${modalStyles.formInput} ${styles.notesTextarea}`}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Notas internas sobre el cliente…"
                  maxLength={1000}
                  rows={3}
                  disabled={isBusy}
                />
              </div>
            </section>

            <section
              className={`${styles.formColumn} ${styles.formColumnDivided}`}
              aria-label="Identificación y condición de IVA"
            >
              <h3 className={styles.formSectionTitle}>
                Identificación y condición de IVA
              </h3>

              <div className={styles.identityGrid}>
                <div className={styles.identityColumn}>
                  <div className={modalStyles.formField}>
                    <span className={modalStyles.formLabel}>
                      Tipo de identificación
                    </span>
                    <div
                      className={styles.segmentGroup}
                      role="radiogroup"
                      aria-label="Tipo de identificación"
                    >
                      {IDENTIFICATION_OPTIONS.map((option) => {
                        const isActive = identificationType === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            className={`${styles.segmentButton} ${
                              isActive ? styles.segmentButtonActive : ""
                            }`}
                            onClick={() =>
                              handleIdentificationTypeChange(option.value)
                            }
                            disabled={isBusy}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {showDocumentInput ? (
                    <div className={modalStyles.formField}>
                      <label
                        className={modalStyles.formLabel}
                        htmlFor="client-identification"
                      >
                        {IDENTIFICATION_TYPE_LABELS[identificationType]}
                      </label>
                      <input
                        id="client-identification"
                        className={modalStyles.formInput}
                        value={identificationNumber}
                        onChange={(event) =>
                          handleIdentificationNumberChange(event.target.value)
                        }
                        inputMode="numeric"
                        placeholder={isCuit ? "20-12345678-3" : "12345678"}
                        maxLength={20}
                        required
                        disabled={isBusy}
                      />
                      <p className={styles.formHint}>
                        {isCuit
                          ? "Se guarda sin guiones y se valida con el dígito verificador."
                          : "Solo números, sin puntos."}
                      </p>
                    </div>
                  ) : (
                    <p className={styles.formHint}>
                      El cliente operará como consumidor final genérico, sin
                      documento asociado.
                    </p>
                  )}
                </div>

                <div className={styles.identityColumn}>
                  <div className={modalStyles.formField}>
                    <span className={modalStyles.formLabel}>
                      Condición de IVA
                    </span>
                    <div
                      className={styles.ivaOptionsGroup}
                      role="radiogroup"
                      aria-label="Condición de IVA"
                    >
                      {IVA_CONDITION_ORDER.map((condition) => {
                        const isEnabled =
                          isCuit || condition === "CONSUMIDOR_FINAL";
                        const isActive = ivaCondition === condition;

                        return (
                          <button
                            key={condition}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            className={`${styles.ivaOptionButton} ${
                              isActive ? styles.ivaOptionButtonActive : ""
                            }`}
                            onClick={() => setIvaCondition(condition)}
                            disabled={isBusy || !isEnabled}
                            title={IVA_CONDITION_LABELS[condition]}
                          >
                            <span className={styles.ivaOptionShort}>
                              {IVA_CONDITION_SHORT_LABELS[condition]}
                            </span>
                            <span className={styles.ivaOptionLabel}>
                              {IVA_CONDITION_LABELS[condition]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className={styles.formHint}>
                      Sin CUIT solo se habilita Consumidor Final.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {visibleError ? (
            <p className={styles.formErrorPill} role="alert">
              {visibleError}
            </p>
          ) : null}

          <div className={modalStyles.modalActions}>
            <button
              type="submit"
              className={modalStyles.modalSaveButton}
              disabled={isBusy || name.trim().length === 0}
            >
              {isBusy
                ? "Guardando…"
                : mode === "create"
                  ? "Crear cliente"
                  : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>

      {showDiscardConfirm ? (
        <div className={wizardStyles.confirmOverlay}>
          <div
            className={`${wizardStyles.confirmCard} ${wizardStyles.closeConfirmCard}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="client-discard-title"
            aria-describedby="client-discard-text"
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <div className={wizardStyles.closeConfirmIcon} aria-hidden>
              <AlertTriangle strokeWidth={ICON_STROKE} />
            </div>
            <h3
              id="client-discard-title"
              className={wizardStyles.closeConfirmTitle}
            >
              ¿Descartar cambios?
            </h3>
            <p
              id="client-discard-text"
              className={wizardStyles.closeConfirmText}
            >
              Los datos cargados no se guardarán si cierra el formulario ahora.
            </p>
            <div className={wizardStyles.closeConfirmActions}>
              <button
                type="button"
                className={wizardStyles.primaryButton}
                onClick={() => setShowDiscardConfirm(false)}
              >
                Seguir editando
              </button>
              <button
                type="button"
                className={wizardStyles.dangerButton}
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onClose();
                }}
              >
                Descartar cambios
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
