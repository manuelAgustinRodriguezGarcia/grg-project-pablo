"use client";

import dynamic from "next/dynamic";
import styles from "./ImportWizard.module.scss";

function ImportWizardChunkLoading() {
  return (
    <div className={styles.loading} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.loadingText}>Cargando importador…</span>
    </div>
  );
}

export const LazyImportWizard = dynamic(
  () =>
    import("@/features/imports/components/ImportWizard").then((module) => ({
      default: module.ImportWizard,
    })),
  {
    ssr: false,
    loading: () => <ImportWizardChunkLoading />,
  },
);
