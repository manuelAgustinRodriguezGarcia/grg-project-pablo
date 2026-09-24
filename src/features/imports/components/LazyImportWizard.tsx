"use client";

import dynamic from "next/dynamic";

export const LazyImportWizard = dynamic(
  () =>
    import("@/features/imports/components/ImportWizard").then((module) => ({
      default: module.ImportWizard,
    })),
  {
    ssr: false,
  },
);
