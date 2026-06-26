import {
  UPLOADED_FILE_STATUS_LABELS,
  UPLOADED_FILE_STATUS_VARIANTS,
} from "@/features/files/data/status-labels";
import styles from "@/features/files/styles/FilesManager.module.scss";

type UploadedFileStatusBadgeProps = {
  status: string;
};

export function UploadedFileStatusBadge({ status }: UploadedFileStatusBadgeProps) {
  const label = UPLOADED_FILE_STATUS_LABELS[status] ?? status;
  const variant = UPLOADED_FILE_STATUS_VARIANTS[status] ?? "neutral";

  return (
    <span className={`${styles.statusBadge} ${styles[`statusBadge${capitalize(variant)}`]}`}>
      {label}
    </span>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
