"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ADMIN_HOME_PATH } from "@/server/auth/config";
import { loginFormAction } from "@/features/auth/actions/login-form.action";
import {
  clearRememberedEmail,
  readRememberedEmail,
  writeRememberedEmail,
} from "@/features/auth/lib/login-credentials.storage";
import type { AuthActionResult } from "@/server/auth/types";
import sharedStyles from "../styles/loginShared.module.scss";
import { Eye, EyeOff, Home, Info, Lock, Mail, ICON_STROKE } from "@/shared/icons";
import styles from "./LoginFormCard.module.scss";

type LoginFormCardProps = {
  redirectTo?: string;
};

export function LoginFormCard({ redirectTo = ADMIN_HOME_PATH }: LoginFormCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [state, formAction, isPending] = useActionState<
    AuthActionResult | null,
    FormData
  >(loginFormAction, null);

  useEffect(() => {
    const rememberedEmail = readRememberedEmail();
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberEmail(true);
    }
  }, []);

  function handleSubmit() {
    if (rememberEmail) {
      writeRememberedEmail(email);
    } else {
      clearRememberedEmail();
    }
  }

  return (
    <div className={styles.wrapper}>
      <form
        action={formAction}
        onSubmit={handleSubmit}
        className={`${styles.card} ${sharedStyles.animateSlideUp} ${sharedStyles.animateDelay1}`}
        aria-labelledby="login-heading"
        noValidate
      >
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <header className={styles.cardHeader}>
          <h1 id="login-heading" className={styles.title}>
            Iniciar Sesión
          </h1>
          <p className={styles.intro}>
            Ingrese su correo electrónico y contraseña.
          </p>
        </header>

        <div className={styles.field}>
        <label className={styles.label} htmlFor="login-email">
          Correo electrónico
        </label>
        <div className={styles.inputWrap}>
          <Mail className={styles.inputIcon} strokeWidth={ICON_STROKE} aria-hidden />
          <input
            id="login-email"
            className={styles.input}
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ejemplo@empresa.com"
            autoComplete="email"
            required
            disabled={isPending}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="login-password">
          Contraseña
        </label>
        <div className={styles.inputWrap}>
          <Lock className={styles.inputIcon} strokeWidth={ICON_STROKE} aria-hidden />
          <input
            id="login-password"
            className={styles.input}
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Ingrese su contraseña"
            autoComplete="current-password"
            required
            minLength={8}
            disabled={isPending}
          />
          <button
            type="button"
            className={styles.eyeButton}
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            disabled={isPending}
          >
            {showPassword ? (
              <EyeOff className={styles.eyeIcon} strokeWidth={ICON_STROKE} aria-hidden />
            ) : (
              <Eye className={styles.eyeIcon} strokeWidth={ICON_STROKE} aria-hidden />
            )}
          </button>
        </div>
      </div>

      <label className={styles.rememberRow} htmlFor="login-remember-email">
        <input
          id="login-remember-email"
          className={styles.rememberCheckbox}
          type="checkbox"
          checked={rememberEmail}
          onChange={(event) => setRememberEmail(event.target.checked)}
          disabled={isPending}
        />
        <span className={styles.rememberBox} aria-hidden="true" />
        <span className={styles.rememberLabel}>Recordar mi correo</span>
      </label>

      <button
        type="submit"
        className={styles.primaryButton}
        disabled={isPending}
      >
        <Lock className={styles.buttonIcon} strokeWidth={ICON_STROKE} aria-hidden />
        <span>{isPending ? "Ingresando…" : "Ingresar"}</span>
      </button>

      <div className={styles.divider}>
        <span className={styles.dividerLine} aria-hidden="true" />
        <span className={styles.dividerText}>o</span>
        <span className={styles.dividerLine} aria-hidden="true" />
      </div>

      <Link href="/" className={styles.secondaryButton}>
        <Home className={styles.buttonIcon} strokeWidth={ICON_STROKE} aria-hidden />
        <span>Volver al Inicio</span>
      </Link>
      </form>

      {state?.success === false ? (
        <div className={styles.errorAlert} role="alert" aria-live="polite">
          <Info className={styles.errorIcon} strokeWidth={ICON_STROKE} aria-hidden />
          <p className={styles.errorText}>{state.error}</p>
        </div>
      ) : null}
    </div>
  );
}
