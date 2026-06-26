import type { ImportJobStatus } from "@/generated/prisma/client";
import {
  IMPORT_JOB_STATUS_LABELS,
  IMPORT_JOB_STATUS_VARIANTS,
} from "@/features/files/data/status-labels";
import styles from "@/features/files/styles/FilesManager.module.scss";

type ImportJobStatusBadgeProps = {
  status: ImportJobStatus | string;
};

export function ImportJobStatusBadge({ status }: ImportJobStatusBadgeProps) {
  const label =
    status in IMPORT_JOB_STATUS_LABELS
      ? IMPORT_JOB_STATUS_LABELS[status as ImportJobStatus]
      : status;
  const variant =
    status in IMPORT_JOB_STATUS_VARIANTS
      ? IMPORT_JOB_STATUS_VARIANTS[status as ImportJobStatus]
      : "neutral";

  return (
    <span className={`${styles.statusBadge} ${styles[`statusBadge${capitalize(variant)}`]}`}>
      {label}
    </span>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
