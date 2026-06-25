import { useCallback, useEffect, useRef } from "react";

const DISARM_DELAY_MS = 500;

export function useNativeFilePickerOutsideClickGuard() {
  const armedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusListenerRef = useRef<(() => void) | null>(null);

  const disarmSoon = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      armedRef.current = false;
      timeoutRef.current = null;
    }, DISARM_DELAY_MS);
  }, []);

  const cleanupFocusListener = useCallback(() => {
    if (focusListenerRef.current) {
      window.removeEventListener("focus", focusListenerRef.current);
      focusListenerRef.current = null;
    }
  }, []);

  const armForNativeFilePicker = useCallback(() => {
    armedRef.current = true;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    cleanupFocusListener();

    const onWindowFocus = () => {
      cleanupFocusListener();
      disarmSoon();
    };

    focusListenerRef.current = onWindowFocus;
    window.addEventListener("focus", onWindowFocus);
  }, [cleanupFocusListener, disarmSoon]);

  const notifyNativeFilePickerSettled = useCallback(() => {
    cleanupFocusListener();
    disarmSoon();
  }, [cleanupFocusListener, disarmSoon]);

  const shouldIgnoreOutsideClose = useCallback(() => armedRef.current, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      cleanupFocusListener();
    };
  }, [cleanupFocusListener]);

  return {
    armForNativeFilePicker,
    notifyNativeFilePickerSettled,
    shouldIgnoreOutsideClose,
  };
}
