"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_VISIBLE_MS = 1600;
const TOAST_TOTAL_MS = 2000;

export function useCopiedToast() {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const unmountTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (unmountTimerRef.current !== null) {
      window.clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const showCopiedToast = useCallback(() => {
    clearTimers();
    setIsHiding(false);
    setIsMounted(true);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });

    hideTimerRef.current = window.setTimeout(() => {
      setIsHiding(true);
      setIsVisible(false);
    }, TOAST_VISIBLE_MS);

    unmountTimerRef.current = window.setTimeout(() => {
      setIsMounted(false);
      setIsHiding(false);
    }, TOAST_TOTAL_MS);
  }, [clearTimers]);

  return {
    isMounted,
    isVisible,
    isHiding,
    showCopiedToast,
  };
}
