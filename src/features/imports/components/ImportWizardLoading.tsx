"use client";

import { useEffect, useState } from "react";
import styles from "./ImportWizard.module.scss";

type ImportWizardLoadingProps = {
  message: string;
  progressTarget: number;
  isComplete: boolean;
  onExitComplete: () => void;
};

const HOLD_AT_100_MS = 380;
const FADE_OUT_MS = 320;

export function ImportWizardLoading({
  message,
  progressTarget,
  isComplete,
  onExitComplete,
}: ImportWizardLoadingProps) {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const displayPercent = Math.round(progress);

  useEffect(() => {
    setIsExiting(false);
  }, [message]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProgress((current) => {
        const cap = isComplete ? 100 : Math.min(97, progressTarget);

        if (current >= cap) {
          return current;
        }

        const delta = cap - current;
        const step = isComplete
          ? Math.max(1.5, delta * 0.25)
          : Math.max(0.35, delta * 0.12);

        return Math.min(cap, current + step);
      });
    }, 45);

    return () => {
      window.clearInterval(interval);
    };
  }, [progressTarget, isComplete]);

  useEffect(() => {
    if (!isComplete || progress < 99.5) {
      return;
    }

    const holdTimer = window.setTimeout(() => {
      setIsExiting(true);
    }, HOLD_AT_100_MS);

    return () => {
      window.clearTimeout(holdTimer);
    };
  }, [isComplete, progress]);

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
