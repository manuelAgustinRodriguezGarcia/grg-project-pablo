"use client";

import { useEffect } from "react";

const SCROLLBAR_HIDDEN_CLASS = "login-scrollbar-hidden";

export function LoginScrollbarHide() {
  useEffect(() => {
    document.documentElement.classList.add(SCROLLBAR_HIDDEN_CLASS);

    return () => {
      document.documentElement.classList.remove(SCROLLBAR_HIDDEN_CLASS);
    };
  }, []);

  return null;
}
