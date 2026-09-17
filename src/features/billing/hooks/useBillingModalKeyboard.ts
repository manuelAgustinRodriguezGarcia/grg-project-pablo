"use client";

import { useEffect } from "react";

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }

  return target.isContentEditable;
}

export function useEscapeToClose(
  onClose: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onClose]);
}

export type BillingSuccessShortcutHandlers = {
  onPrint?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onCreateNew?: () => void;
  onList?: () => void;
  onClose?: () => void;
};

export function useBillingSuccessShortcuts(
  handlers: BillingSuccessShortcutHandlers,
  enabled = true,
): void {
  const {
    onPrint,
    onDownload,
    onShare,
    onCreateNew,
    onList,
    onClose,
  } = handlers;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (event.key === "Escape") {
        if (!onClose) {
          return;
        }
        event.preventDefault();
        onClose();
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      switch (key) {
        case "i":
          if (!onPrint) {
            return;
          }
          event.preventDefault();
          onPrint();
          return;
        case "d":
          if (!onDownload) {
            return;
          }
          event.preventDefault();
          onDownload();
          return;
        case "c":
          if (!onShare) {
            return;
          }
          event.preventDefault();
          onShare();
          return;
        case "n":
          if (!onCreateNew) {
            return;
          }
          event.preventDefault();
          onCreateNew();
          return;
        case "l":
          if (!onList) {
            return;
          }
          event.preventDefault();
          onList();
          return;
        default:
          return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onClose, onCreateNew, onDownload, onList, onPrint, onShare]);
}
