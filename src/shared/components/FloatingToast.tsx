"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "@/shared/components/FloatingToast.module.scss";

const TOAST_VISIBLE_MS = 2800;
const TOAST_ANIMATION_MS = 400;
const TOAST_TOTAL_MS = TOAST_VISIBLE_MS + TOAST_ANIMATION_MS;

type FloatingToastProps = {
  message: string | null;
  onDismiss: () => void;
};

export function FloatingToast({ message, onDismiss }: FloatingToastProps) {
  const [displayMessage, setDisplayMessage] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (!message) {
      return;
    }

    for (const timer of timersRef.current) {
      window.clearTimeout(timer);
    }
    timersRef.current = [];

    setDisplayMessage(message);
    setIsHiding(false);
    setIsVisible(false);

    const showTimer = window.setTimeout(() => {
      setIsVisible(true);
    }, 20);

    const hideTimer = window.setTimeout(() => {
      setIsHiding(true);
      setIsVisible(false);
    }, TOAST_VISIBLE_MS);

    const dismissTimer = window.setTimeout(() => {
      setDisplayMessage(null);
      setIsHiding(false);
      onDismiss();
    }, TOAST_TOTAL_MS);

    timersRef.current = [showTimer, hideTimer, dismissTimer];

    return () => {
      for (const timer of timersRef.current) {
        window.clearTimeout(timer);
      }
      timersRef.current = [];
    };
  }, [message, onDismiss]);

  if (!displayMessage || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`${styles.toast} ${isVisible ? styles.toastVisible : ""} ${isHiding ? styles.toastHiding : ""}`}
      role="status"
      aria-live="polite"
    >
      {displayMessage}
    </div>,
    document.body,
  );
}
