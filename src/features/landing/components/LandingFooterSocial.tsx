"use client";

import { createPortal } from "react-dom";
import {
  EMAIL_DISPLAY,
  PHONE_DISPLAY,
} from "@/features/landing/data/landingData";
import { Mail, ICON_STROKE } from "@/shared/icons";
import { WhatsAppIcon } from "@/shared/components/WhatsAppIcon";
import { copyTextToClipboard } from "@/shared/clipboard/copy-to-clipboard";
import { useCopiedToast } from "@/shared/hooks/use-copied-toast";
import styles from "./LandingFooter.module.scss";

export function LandingFooterSocial() {
  const { isMounted, isVisible, isHiding, showCopiedToast } = useCopiedToast();

  async function handleCopy(value: string) {
    try {
      await copyTextToClipboard(value);
      showCopiedToast();
    } catch {
      // Ignore clipboard errors silently.
    }
  }

  const toast =
    isMounted && typeof document !== "undefined"
      ? createPortal(
          <div
            className={`${styles.copyToast} ${isVisible ? styles.copyToastVisible : ""} ${isHiding ? styles.copyToastHiding : ""}`}
            role="status"
            aria-live="polite"
          >
            Copiado en portapapeles
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className={styles.socialCol}>
        <button
          type="button"
          className={styles.socialLink}
          onClick={() => void handleCopy(PHONE_DISPLAY)}
          aria-label={`Copiar número de WhatsApp ${PHONE_DISPLAY}`}
        >
          <WhatsAppIcon className={styles.socialIcon} />
        </button>
        <button
          type="button"
          className={styles.socialLink}
          onClick={() => void handleCopy(EMAIL_DISPLAY)}
          aria-label={`Copiar correo electrónico ${EMAIL_DISPLAY}`}
        >
          <Mail className={styles.socialIcon} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </div>
      {toast}
    </>
  );
}
