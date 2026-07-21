"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CustomSelect } from "@/shared/components/CustomSelect";
import type { UserListItem } from "@/features/users/types/user.types";
import { USER_ROLE_LABELS } from "@/features/users/types/user.types";
import type { UserRole } from "@/generated/prisma/client";
import { Eye, EyeOff, ICON_STROKE } from "@/shared/icons";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = (
  ["ADMIN", "USUARIO"] as const
).map((role) => ({
  value: role,
  label: USER_ROLE_LABELS[role],
}));

export type UserFormValues = {
  name: string;
  email: string;
  role: UserRole;
  password: string;
};

type UserFormModalProps = {
  mode: "create" | "edit";
  initialUser?: UserListItem | null;
  isBusy: boolean;
  error: string | null;
  isSelf: boolean;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => void;
};

export function UserFormModal({
  mode,
  initialUser,
  isBusy,
  error,
  isSelf,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const [name, setName] = useState(initialUser?.name ?? "");
  const [email, setEmail] = useState(initialUser?.email ?? "");
  const [role, setRole] = useState<UserRole>(initialUser?.role ?? "USUARIO");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      role,
      password,
    });
  }

  const title = mode === "create" ? "Nuevo usuario" : "Editar usuario";
  const subtitle =
    mode === "create"
      ? "Creá una cuenta con correo, contraseña y rol."
      : "Actualizá los datos del usuario. Dejá la contraseña vacía para no cambiarla.";

  return createPortal(
    <div
      className={modalStyles.modalOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          onClose();
        }
      }}
    >
      <div
        className={modalStyles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-form-title"
      >
        <h2 id="user-form-title" className={modalStyles.modalTitle}>
          {title}
        </h2>
        <p className={modalStyles.modalSubtitle}>{subtitle}</p>

        <form onSubmit={handleSubmit}>
          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="user-name">
              Nombre
            </label>
            <input
              id="user-name"
              className={modalStyles.formInput}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              required
              autoFocus
              disabled={isBusy}
            />
          </div>

          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="user-email">
              Correo
            </label>
            <input
              id="user-email"
              type="email"
              className={modalStyles.formInput}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={isBusy}
            />
          </div>

          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="user-role">
              Rol
            </label>
            <CustomSelect
              id="user-role"
              value={role}
              onChange={(next) => setRole(next as UserRole)}
              disabled={isBusy || (isSelf && mode === "edit")}
              ariaLabel="Rol del usuario"
              options={ROLE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
            {isSelf && mode === "edit" ? (
              <p className={modalStyles.modalSubtitle}>
                No podés cambiar tu propio rol de administrador.
              </p>
            ) : null}
          </div>

          <div className={modalStyles.formField}>
            <label className={modalStyles.formLabel} htmlFor="user-password">
              {mode === "create" ? "Contraseña" : "Nueva contraseña (opcional)"}
            </label>
            <div className={modalStyles.passwordInputWrap}>
              <input
                id="user-password"
                type={showPassword ? "text" : "password"}
                className={`${modalStyles.formInput} ${modalStyles.passwordInput}`}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={mode === "create" ? 8 : undefined}
                maxLength={72}
                required={mode === "create"}
                autoComplete={mode === "create" ? "new-password" : "off"}
                disabled={isBusy}
              />
              <button
                type="button"
                className={modalStyles.passwordEyeButton}
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                disabled={isBusy}
              >
                {showPassword ? (
                  <EyeOff
                    className={modalStyles.passwordEyeIcon}
                    strokeWidth={ICON_STROKE}
                    aria-hidden
                  />
                ) : (
                  <Eye
                    className={modalStyles.passwordEyeIcon}
                    strokeWidth={ICON_STROKE}
                    aria-hidden
                  />
                )}
              </button>
            </div>
          </div>

          {error ? <p className={modalStyles.formError}>{error}</p> : null}

          <div className={modalStyles.modalActions}>
            <button
              type="button"
              className={modalStyles.modalCancelButton}
              onClick={onClose}
              disabled={isBusy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={modalStyles.modalSaveButton}
              disabled={isBusy || name.trim().length === 0 || email.trim().length === 0}
            >
              {isBusy
                ? "Guardando…"
                : mode === "create"
                  ? "Crear usuario"
                  : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
