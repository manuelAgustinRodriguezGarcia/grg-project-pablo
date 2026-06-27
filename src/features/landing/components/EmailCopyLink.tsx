"use client";

import { createPortal } from "react-dom";
import { copyTextToClipboard } from "@/shared/clipboard/copy-to-clipboard";
import { useCopiedToast } from "@/shared/hooks/use-copied-toast";
import styles from "./ContactSection.module.scss";

type EmailCopyLinkProps = {
  email: string;
};

export function EmailCopyLink({ email }: EmailCopyLinkProps) {
  const { isMounted, isVisible, isHiding, showCopiedToast } = useCopiedToast();

  const handleClick = async () => {
    try {
      await copyTextToClipboard(email);
      showCopiedToast();
    } catch {
      // Ignore clipboard errors silently.
    }
  };

  const toast =
    isMounted && typeof document !== "undefined"
      ? createPortal(
          <div
            className={`${styles.emailCopyToast} ${isVisible ? styles.emailCopyToastVisible : ""} ${isHiding ? styles.emailCopyToastHiding : ""}`}
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
      <button
        type="button"
        className={styles.emailCopyButton}
        onClick={() => void handleClick()}
        aria-label={`Copiar correo electrónico ${email}`}
      >
        {email}
      </button>
      {toast}
    </>
  );
}
