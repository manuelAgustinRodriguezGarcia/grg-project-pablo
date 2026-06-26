"use client";

import { useEffect } from "react";

const SCROLLBAR_HIDDEN_CLASS = "landing-scrollbar-hidden";

export function LandingScrollbarHide() {
  useEffect(() => {
    document.documentElement.classList.add(SCROLLBAR_HIDDEN_CLASS);

    return () => {
      document.documentElement.classList.remove(SCROLLBAR_HIDDEN_CLASS);
    };
  }, []);

  return null;
}
