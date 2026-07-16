"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ImportWizard.module.scss";

export type ImportWizardLoadingVariant = "progress" | "spinner";

type ImportWizardLoadingProps = {
  message: string;
  progressTarget: number;
  isComplete: boolean;
  variant?: ImportWizardLoadingVariant;
  onExitComplete: () => void;
};

const HOLD_AT_100_MS = 380;
const HOLD_SPINNER_COMPLETE_MS = 280;
const FADE_OUT_MS = 320;
const WAITING_CEILING = 96;
const TICK_MS = 80;
/** Minimum time between visible +1% bumps while waiting on a long request. */
const MIN_PERCENT_BUMP_MS = 700;

export function ImportWizardLoading({
  message,
  progressTarget,
  isComplete,
  variant = "progress",
  onExitComplete,
}: ImportWizardLoadingProps) {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const displayPercent = Math.round(progress);
  const isSpinner = variant === "spinner";
  const lastBumpAtRef = useRef(0);
  const lastDisplayedPercentRef = useRef(0);

  useEffect(() => {
    setIsExiting(false);
  }, [message, variant]);

  useEffect(() => {
    if (isSpinner) {
      return;
    }

    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (isComplete) {
          if (current >= 100) {
            return 100;
          }
          const delta = 100 - current;
          return Math.min(100, current + Math.max(2, delta * 0.3));
        }

        const stall = Math.min(WAITING_CEILING - 2, Math.max(1, progressTarget));
        let next: number;

        if (current < stall) {
          const delta = stall - current;
          next = Math.min(
            stall,
            current + Math.max(0.5, delta * 0.12 + Math.random() * 0.3),
          );
        } else {
          // Steady crawl — never idle while waiting.
          next = Math.min(WAITING_CEILING, current + 0.2 + Math.random() * 0.25);
        }

        const now = Date.now();
        const nextDisplay = Math.floor(next);
        const lastDisplay = lastDisplayedPercentRef.current;

        if (
          nextDisplay <= lastDisplay &&
          lastDisplay < WAITING_CEILING &&
          now - lastBumpAtRef.current >= MIN_PERCENT_BUMP_MS
        ) {
          next = Math.min(WAITING_CEILING, lastDisplay + 1);
          lastBumpAtRef.current = now;
          lastDisplayedPercentRef.current = Math.floor(next);
          return next;
        }

        if (nextDisplay > lastDisplay) {
          lastBumpAtRef.current = now;
          lastDisplayedPercentRef.current = nextDisplay;
        }

        return next;
      });
    }, TICK_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [isComplete, isSpinner, progressTarget]);

  useEffect(() => {
    if (!isComplete) {
      return;
    }

    if (isSpinner) {
      const holdTimer = window.setTimeout(() => {
        setIsExiting(true);
      }, HOLD_SPINNER_COMPLETE_MS);
      return () => {
        window.clearTimeout(holdTimer);
      };
    }

    if (progress < 99.5) {
      return;
    }

    const holdTimer = window.setTimeout(() => {
      setIsExiting(true);
    }, HOLD_AT_100_MS);

    return () => {
      window.clearTimeout(holdTimer);
    };
  }, [isComplete, isSpinner, progress]);

  useEffect(() => {
    if (!isExiting) {
      return;
    }

    const exitTimer = window.setTimeout(() => {
      onExitComplete();
    }, FADE_OUT_MS);

    return () => {
      window.clearTimeout(exitTimer);
    };
  }, [isExiting, onExitComplete]);

  if (isSpinner) {
    return (
      <div
        className={`${styles.loading} ${styles.loadingSpinner} ${isExiting ? styles.loadingExiting : ""}`}
        role="status"
        aria-live="polite"
        aria-busy={!isExiting}
      >
        <div className={styles.spinner} aria-hidden />
        <p className={styles.loadingSpinnerText}>{message}</p>
      </div>
    );
  }

  return (
    <div
      className={`${styles.loading} ${isExiting ? styles.loadingExiting : ""}`}
      role="status"
      aria-live="polite"
      aria-busy={!isExiting}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={displayPercent}
    >
      <div className={styles.loadingHeader}>
        <span className={styles.loadingText}>{message}</span>
        <span className={styles.loadingPercent}>{displayPercent}%</span>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
