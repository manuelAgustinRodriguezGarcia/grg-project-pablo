"use client";

import type { LucideIcon } from "lucide-react";
import type { BillingDocumentActivity } from "@/features/billing/types/billing-document-activity";
import { Download, ICON_STROKE, Printer, Share2 } from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type DocumentActivityBadgesProps = {
  activity: BillingDocumentActivity;
};

function ActivityChip({
  done,
  label,
  pendingLabel,
  icon: Icon,
}: {
  done: boolean;
  label: string;
  pendingLabel: string;
  icon: LucideIcon;
}) {
  const statusLabel = done ? label : pendingLabel;

  return (
    <span className={styles.rowActionWrap}>
      <span
        className={`${styles.activityChip} ${
          done ? styles.activityChipOn : styles.activityChipOff
        }`}
        aria-label={statusLabel}
      >
        <Icon strokeWidth={ICON_STROKE} aria-hidden />
      </span>
      <span className={styles.rowActionTooltip} role="tooltip">
        {statusLabel}
      </span>
    </span>
  );
}

export function DocumentActivityBadges({
  activity,
}: DocumentActivityBadgesProps) {
  return (
    <div className={styles.activityBadges} aria-label="Estado del documento">
      <ActivityChip
        done={activity.downloadedAt !== null}
        label="Descargado"
        pendingLabel="No descargado"
        icon={Download}
      />
      <ActivityChip
        done={activity.printedAt !== null}
        label="Impreso"
        pendingLabel="No impreso"
        icon={Printer}
      />
      <ActivityChip
        done={activity.sharedAt !== null}
        label="Compartido"
        pendingLabel="No compartido"
        icon={Share2}
      />
    </div>
  );
}
