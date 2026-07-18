"use client";

import { useEffect, useState } from "react";
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
const TICK_MS = 45;
/** Soft ceiling while waiting — approached asymptotically, never a hard stop. */
const WAITING_CEILING = 99;
/**
 * Per-tick fraction of remaining distance above the stall.
 * Slow enough that typical waits only gain a few points past the target,
 * but the bar never freezes at a fixed percent.
 */
const CRAWL_RATE = 0.0035;

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
          return Math.min(100, current + Math.max(1.5, delta * 0.25));
        }

        // Ease toward the stage target (same feel as the original bar).
        const stall = Math.min(WAITING_CEILING - 0.5, Math.max(1, progressTarget));

        if (current < stall) {
          const delta = stall - current;
          const step = Math.max(0.35, delta * 0.12);
          return Math.min(stall, current + step);
        }

        // Past the target: keep crawling toward the soft ceiling.
        // Speed falls as we get closer, so we don't rush to 99% and sit there.
        const remaining = WAITING_CEILING - current;
        if (remaining <= 0.01) {
          return WAITING_CEILING - 0.01;
        }

        return current + remaining * CRAWL_RATE;
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
