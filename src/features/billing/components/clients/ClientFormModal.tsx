"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
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
import {
  findClientFormMatches,
  formatClientFormMatchLine,
  hasExactIdentificationDuplicate,
} from "@/features/billing/utils/client-form-matches";
import { CustomSelect } from "@/shared/components/CustomSelect";
import { ARGENTINE_PROVINCES, isArgentineProvince } from "@/shared/utils/argentine-provinces";
import {
  formatCuit,
  formatDni,
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
  existingClients?: BillingClientListItem[];
  identificationLocked?: boolean;
  isBusy: boolean;
  error: string | null;
  onClearError: () => void;
  onClose: () => void;
  onSubmit: (values: ClientFormValues) => void;
};

const CREATE_DEFAULT_IDENTIFICATION: BillingIdentificationType = "CUIT";
const CREATE_DEFAULT_IVA: BillingIvaCondition = "RESPONSABLE_INSCRIPTO";

type MatchFieldKey = "name" | "email" | "whatsapp" | "identification";

const AUTOFILL_OFF = {
  autoComplete: "off" as const,
  autoCorrect: "off" as const,
  autoCapitalize: "off" as const,
  spellCheck: false as const,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-form-type": "other",
};

export function ClientFormModal({
  mode,
  initialClient,
  existingClients = [],
  identificationLocked = false,
  isBusy,
  error,
  onClearError,
  onClose,
  onSubmit,
}: ClientFormModalProps) {
  const defaultIdentificationType =
    initialClient?.identificationType ??
    (mode === "create" ? CREATE_DEFAULT_IDENTIFICATION : "NINGUNO");
  const defaultIvaCondition =
    initialClient?.ivaCondition ??
    (mode === "create" ? CREATE_DEFAULT_IVA : "CONSUMIDOR_FINAL");

  const [name, setName] = useState(initialClient?.name ?? "");
  const [code, setCode] = useState(initialClient?.code ?? "");
  const [address, setAddress] = useState(initialClient?.address ?? "");
  const [city, setCity] = useState(initialClient?.city ?? "");
  const [province, setProvince] = useState(initialClient?.province ?? "");
  const [email, setEmail] = useState(initialClient?.email ?? "");
  const [whatsapp, setWhatsapp] = useState(initialClient?.whatsapp ?? "");
  const [identificationType, setIdentificationType] =
    useState<BillingIdentificationType>(defaultIdentificationType);
  const [identificationNumber, setIdentificationNumber] = useState(
    initialClient?.identificationNumber ?? "",
  );
  const [ivaCondition, setIvaCondition] =
    useState<BillingIvaCondition>(defaultIvaCondition);
  const [notes, setNotes] = useState(initialClient?.notes ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const [provinceError, setProvinceError] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [pendingSubmitValues, setPendingSubmitValues] =
    useState<ClientFormValues | null>(null);
  const [activeMatchField, setActiveMatchField] =
    useState<MatchFieldKey | null>(null);

  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const identificationTypeRefs = useRef<
    Partial<Record<BillingIdentificationType, HTMLButtonElement | null>>
  >({});
  const ivaConditionRefs = useRef<
    Partial<Record<BillingIvaCondition, HTMLButtonElement | null>>
  >({});

  const isDirty =
    name !== (initialClient?.name ?? "") ||
    code !== (initialClient?.code ?? "") ||
    address !== (initialClient?.address ?? "") ||
    city !== (initialClient?.city ?? "") ||
    province !== (initialClient?.province ?? "") ||
    email !== (initialClient?.email ?? "") ||
    whatsapp !== (initialClient?.whatsapp ?? "") ||
    identificationType !== defaultIdentificationType ||
    identificationNumber !== (initialClient?.identificationNumber ?? "") ||
    ivaCondition !== defaultIvaCondition ||
    notes !== (initialClient?.notes ?? "");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || isBusy) {
        return;
      }

      if (pendingSubmitValues) {
        setPendingSubmitValues(null);
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
  }, [isBusy, isDirty, pendingSubmitValues, showDiscardConfirm, onClose]);

  const excludeId = mode === "edit" ? initialClient?.id ?? null : null;

  const nameMatches = useMemo(
    () =>
      mode === "create"
        ? findClientFormMatches(existingClients, "name", name, { excludeId })
        : [],
    [excludeId, existingClients, mode, name],
  );

  const emailMatches = useMemo(
    () =>
      mode === "create"
        ? findClientFormMatches(existingClients, "email", email, { excludeId })
        : [],
    [email, excludeId, existingClients, mode],
  );

  const whatsappMatches = useMemo(
    () =>
      mode === "create"
        ? findClientFormMatches(existingClients, "whatsapp", whatsapp, {
            excludeId,
          })
        : [],
    [excludeId, existingClients, mode, whatsapp],
  );

  const identificationMatches = useMemo(
    () =>
      mode === "create" && identificationType !== "NINGUNO"
        ? findClientFormMatches(
            existingClients,
            "identification",
            identificationNumber,
            { excludeId, identificationType },
          )
        : [],
    [
      excludeId,
      existingClients,
      identificationNumber,
      identificationType,
      mode,
    ],
  );

  const hasIdentificationDuplicate = useMemo(
    () =>
      hasExactIdentificationDuplicate(
        existingClients,
        identificationType,
        identificationNumber,
        excludeId,
      ),
    [excludeId, existingClients, identificationNumber, identificationType],
  );

  if (typeof document === "undefined") {
    return null;
  }

  const isCuit = identificationType === "CUIT";
  const showDocumentInput = identificationType !== "NINGUNO";

  function requestClose() {
    if (isBusy) {
      return;
    }

    if (pendingSubmitValues) {
      setPendingSubmitValues(null);
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
    if (identificationLocked || next === identificationType) {
      return;
    }

    setIdentificationType(next);
    setIdentificationNumber("");
    clearVisibleError();

    if (next !== "CUIT") {
      setIvaCondition("CONSUMIDOR_FINAL");
    } else if (mode === "create") {
      setIvaCondition(CREATE_DEFAULT_IVA);
    }
  }

  function handleIdentificationNumberChange(value: string) {
    if (identificationLocked) {
      return;
    }

    setIdentificationNumber(value.replace(isCuit ? /[^\d-]/g : /\D/g, ""));
    clearVisibleError();
  }

  function buildSubmitValues(): ClientFormValues {
    return {
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
    };
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

    if (
      mode === "create" &&
      hasExactIdentificationDuplicate(
        existingClients,
        identificationType,
        identificationNumber,
      )
    ) {
      setLocalError(
        identificationType === "CUIT"
          ? "Ya existe un cliente registrado con este CUIT."
          : "Ya existe un cliente registrado con este DNI.",
      );
      return;
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

    const values = buildSubmitValues();

    if (
      mode === "create" &&
      (values.identificationType === "CUIT" ||
        values.identificationType === "DNI")
    ) {
      setPendingSubmitValues(values);
      return;
    }

    onSubmit(values);
  }

  function focusElementById(id: string) {
    document.getElementById(id)?.focus();
  }

  function focusIdentificationType(type: BillingIdentificationType = identificationType) {
    identificationTypeRefs.current[type]?.focus();
  }

  function focusIvaCondition(condition: BillingIvaCondition = ivaCondition) {
    const enabled =
      identificationType === "CUIT" || condition === "CONSUMIDOR_FINAL"
        ? condition
        : "CONSUMIDOR_FINAL";
    ivaConditionRefs.current[enabled]?.focus();
  }

  function focusSubmitButton() {
    submitButtonRef.current?.focus();
  }

  function advanceFromIdentificationType(type: BillingIdentificationType) {
    if (type === "NINGUNO") {
      focusIvaCondition(
        identificationType === "CUIT" ? ivaCondition : "CONSUMIDOR_FINAL",
      );
      return;
    }
    focusElementById("client-identification");
  }

  function hideMatches() {
    setActiveMatchField(null);
  }

  function handleAdvanceKey(
    event: ReactKeyboardEvent<HTMLElement>,
    advance: () => void,
    matchField?: MatchFieldKey,
  ) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    if (matchField) {
      hideMatches();
    }
    advance();
  }

  function handleIdentificationTypeKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    optionValue: BillingIdentificationType,
  ) {
    if (identificationLocked || isBusy) {
      return;
    }

    const values = IDENTIFICATION_OPTIONS.map((option) => option.value);
    const currentIndex = values.indexOf(optionValue);

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = values[(currentIndex + 1) % values.length];
      handleIdentificationTypeChange(next);
      requestAnimationFrame(() => focusIdentificationType(next));
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const previous =
        values[(currentIndex - 1 + values.length) % values.length];
      handleIdentificationTypeChange(previous);
      requestAnimationFrame(() => focusIdentificationType(previous));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      advanceFromIdentificationType(optionValue);
    }
  }

  function handleIvaConditionKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    condition: BillingIvaCondition,
  ) {
    if (isBusy) {
      return;
    }

    const enabledConditions = IVA_CONDITION_ORDER.filter(
      (item) => identificationType === "CUIT" || item === "CONSUMIDOR_FINAL",
    );
    const currentIndex = enabledConditions.indexOf(condition);

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const next =
        enabledConditions[(currentIndex + 1) % enabledConditions.length];
      setIvaCondition(next);
      requestAnimationFrame(() => focusIvaCondition(next));
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const previous =
        enabledConditions[
          (currentIndex - 1 + enabledConditions.length) %
            enabledConditions.length
        ];
      setIvaCondition(previous);
      requestAnimationFrame(() => focusIvaCondition(previous));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      focusSubmitButton();
    }
  }

  function renderMatchDropdown(
    field: MatchFieldKey,
    matches: BillingClientListItem[],
    tone: "warn" | "block",
  ) {
    if (activeMatchField !== field || matches.length === 0) {
      return null;
    }

    return (
      <div
        className={`${styles.matchDropdown} ${
          tone === "block"
            ? styles.matchDropdownBlock
            : styles.matchDropdownWarn
        }`}
        aria-live="polite"
      >
        <p className={styles.matchDropdownTitle}>Clientes encontrados:</p>
        <ul className={styles.matchDropdownList}>
          {matches.map((client) => (
            <li key={client.id} className={styles.matchDropdownItem}>
              {formatClientFormMatchLine(client)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const identificationConfirmLabel =
    pendingSubmitValues?.identificationType === "CUIT"
      ? formatCuit(pendingSubmitValues.identificationNumber)
      : pendingSubmitValues?.identificationType === "DNI"
        ? formatDni(pendingSubmitValues.identificationNumber)
        : "";

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

        <form onSubmit={handleSubmit} autoComplete="off">
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
                    onKeyDown={(event) =>
                      handleAdvanceKey(event, () =>
                        focusElementById("client-name"),
                      )
                    }
                    placeholder=""
                    maxLength={24}
                    required
                    disabled={isBusy}
                    {...AUTOFILL_OFF}
                  />
                  <p className={styles.formHint}>
                    Formato: iniciales y número de 5 dígitos, por ejemplo
                    GLR-00002.
                  </p>
                </div>
              ) : null}

              <div className={`${modalStyles.formField} ${styles.formFieldWithMatches}`}>
                <label
                  className={modalStyles.formLabel}
                  htmlFor="client-name"
                >
                  Nombre o razón social
                </label>
                <div className={styles.matchInputWrap}>
                  <input
                    id="client-name"
                    className={`${modalStyles.formInput} ${styles.uppercaseInput}${
                      nameMatches.length > 0 ? ` ${styles.formInputWarn}` : ""
                    }`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onFocus={() => setActiveMatchField("name")}
                    onBlur={hideMatches}
                    onKeyDown={(event) =>
                      handleAdvanceKey(
                        event,
                        () => focusElementById("client-address"),
                        "name",
                      )
                    }
                    placeholder=""
                    maxLength={160}
                    required
                    autoFocus={mode === "create"}
                    disabled={isBusy}
                    {...AUTOFILL_OFF}
                  />
                  {renderMatchDropdown("name", nameMatches, "warn")}
                </div>
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
                  onKeyDown={(event) =>
                    handleAdvanceKey(event, () =>
                      focusElementById("client-city"),
                    )
                  }
                  placeholder=""
                  maxLength={160}
                  disabled={isBusy}
                  {...AUTOFILL_OFF}
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
                    onKeyDown={(event) =>
                      handleAdvanceKey(event, () =>
                        focusElementById("client-province"),
                      )
                    }
                    placeholder=""
                    maxLength={160}
                    disabled={isBusy}
                    {...AUTOFILL_OFF}
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
                    onConfirmed={() => focusElementById("client-email")}
                  />
                  {provinceError ? (
                    <p className={modalStyles.formError} role="alert">
                      {provinceError}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={`${modalStyles.formField} ${styles.formFieldWithMatches}`}>
                  <label
                    className={modalStyles.formLabel}
                    htmlFor="client-email"
                  >
                    Email (opcional)
                  </label>
                  <div className={styles.matchInputWrap}>
                    <input
                      id="client-email"
                      type="text"
                      inputMode="email"
                      className={`${modalStyles.formInput}${
                        emailMatches.length > 0 ? ` ${styles.formInputWarn}` : ""
                      }`}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      onFocus={() => setActiveMatchField("email")}
                      onBlur={hideMatches}
                      onKeyDown={(event) =>
                        handleAdvanceKey(
                          event,
                          () => focusElementById("client-whatsapp"),
                          "email",
                        )
                      }
                      placeholder=""
                      maxLength={160}
                      disabled={isBusy}
                      {...AUTOFILL_OFF}
                    />
                    {renderMatchDropdown("email", emailMatches, "warn")}
                  </div>
                </div>

                <div className={`${modalStyles.formField} ${styles.formFieldWithMatches}`}>
                  <label
                    className={modalStyles.formLabel}
                    htmlFor="client-whatsapp"
                  >
                    WhatsApp (opcional)
                  </label>
                  <div className={styles.matchInputWrap}>
                    <input
                      id="client-whatsapp"
                      type="tel"
                      className={`${modalStyles.formInput}${
                        whatsappMatches.length > 0
                          ? ` ${styles.formInputWarn}`
                          : ""
                      }`}
                      value={whatsapp}
                      onChange={(event) => setWhatsapp(event.target.value)}
                      onFocus={() => setActiveMatchField("whatsapp")}
                      onBlur={hideMatches}
                      onKeyDown={(event) =>
                        handleAdvanceKey(
                          event,
                          () => focusElementById("client-notes"),
                          "whatsapp",
                        )
                      }
                      placeholder=""
                      maxLength={30}
                      disabled={isBusy}
                      {...AUTOFILL_OFF}
                    />
                    {renderMatchDropdown("whatsapp", whatsappMatches, "warn")}
                  </div>
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
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey) {
                      return;
                    }
                    handleAdvanceKey(event, () =>
                      focusIdentificationType(identificationType),
                    );
                  }}
                  placeholder=""
                  maxLength={1000}
                  rows={3}
                  disabled={isBusy}
                  {...AUTOFILL_OFF}
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
                            ref={(node) => {
                              identificationTypeRefs.current[option.value] =
                                node;
                            }}
                            className={`${styles.segmentButton} ${
                              isActive ? styles.segmentButtonActive : ""
                            }`}
                            onClick={() =>
                              handleIdentificationTypeChange(option.value)
                            }
                            onKeyDown={(event) =>
                              handleIdentificationTypeKeyDown(
                                event,
                                option.value,
                              )
                            }
                            disabled={isBusy || identificationLocked}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    {identificationLocked ? (
                      <p className={styles.formHint}>
                        El CUIT/DNI no se puede modificar porque el cliente
                        tiene historial.
                      </p>
                    ) : null}
                  </div>

                  {showDocumentInput ? (
                    <div
                      className={`${modalStyles.formField} ${styles.formFieldWithMatches}`}
                    >
                      <label
                        className={modalStyles.formLabel}
                        htmlFor="client-identification"
                      >
                        {IDENTIFICATION_TYPE_LABELS[identificationType]}
                      </label>
                      <div className={styles.matchInputWrap}>
                        <input
                          id="client-identification"
                          className={`${modalStyles.formInput}${
                            hasIdentificationDuplicate
                              ? ` ${styles.formInputBlock}`
                              : identificationMatches.length > 0
                                ? ` ${styles.formInputWarn}`
                                : ""
                          }`}
                          value={identificationNumber}
                          onChange={(event) =>
                            handleIdentificationNumberChange(event.target.value)
                          }
                          onFocus={() => setActiveMatchField("identification")}
                          onBlur={hideMatches}
                          onKeyDown={(event) =>
                            handleAdvanceKey(
                              event,
                              () => focusIvaCondition(ivaCondition),
                              "identification",
                            )
                          }
                          inputMode="numeric"
                          placeholder=""
                          maxLength={20}
                          required
                          disabled={isBusy || identificationLocked}
                          {...AUTOFILL_OFF}
                        />
                        {renderMatchDropdown(
                          "identification",
                          identificationMatches,
                          hasIdentificationDuplicate ? "block" : "warn",
                        )}
                      </div>
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
                            ref={(node) => {
                              ivaConditionRefs.current[condition] = node;
                            }}
                            className={`${styles.ivaOptionButton} ${
                              isActive ? styles.ivaOptionButtonActive : ""
                            }`}
                            onClick={() => setIvaCondition(condition)}
                            onKeyDown={(event) =>
                              handleIvaConditionKeyDown(event, condition)
                            }
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
              ref={submitButtonRef}
              type="submit"
              className={`${modalStyles.modalSaveButton} ${styles.clientFormSaveButton}`}
              disabled={
                isBusy ||
                name.trim().length === 0 ||
                (mode === "create" && hasIdentificationDuplicate)
              }
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

      {pendingSubmitValues ? (
        <div className={wizardStyles.confirmOverlay}>
          <div
            className={`${wizardStyles.confirmCard} ${wizardStyles.closeConfirmCard}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="client-id-confirm-title"
            aria-describedby="client-id-confirm-text"
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <div className={wizardStyles.closeConfirmIcon} aria-hidden>
              <AlertTriangle strokeWidth={ICON_STROKE} />
            </div>
            <h3
              id="client-id-confirm-title"
              className={wizardStyles.closeConfirmTitle}
            >
              Confirmar{" "}
              {pendingSubmitValues.identificationType === "CUIT"
                ? "CUIT"
                : "DNI"}
            </h3>
            <p
              id="client-id-confirm-text"
              className={wizardStyles.closeConfirmText}
            >
              {pendingSubmitValues.identificationType === "CUIT"
                ? `Está por crear un cliente con el CUIT ${identificationConfirmLabel}. ¿Confirma que el CUIT ingresado es correcto?`
                : `Está por crear un cliente con el DNI ${identificationConfirmLabel}. ¿Confirma que el DNI ingresado es correcto?`}
            </p>
            <div className={wizardStyles.closeConfirmActions}>
              <button
                type="button"
                className={wizardStyles.primaryButton}
                disabled={isBusy}
                onClick={() => {
                  const values = pendingSubmitValues;
                  setPendingSubmitValues(null);
                  onSubmit(values);
                }}
              >
                Confirmar
              </button>
              <button
                type="button"
                className={wizardStyles.secondaryButton}
                disabled={isBusy}
                onClick={() => setPendingSubmitValues(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
