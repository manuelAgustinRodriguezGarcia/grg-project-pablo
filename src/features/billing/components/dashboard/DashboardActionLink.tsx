import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { DashboardQuickLink } from "@/features/billing/data/dashboardTypes";
import { ICON_STROKE, ReceiptText, TableProperties, Wallet } from "@/shared/icons";
import styles from "@/features/billing/styles/Dashboard.module.scss";

const ACTION_ICONS: Record<string, LucideIcon> = {
  "/admin/facturacion/nueva-factura": ReceiptText,
  "/admin/facturacion/deudores": Wallet,
  "/admin/archivos": TableProperties,
};

const ACTION_TONES: Record<string, string> = {
  "/admin/facturacion/nueva-factura": styles.actionToneBlueLight,
  "/admin/facturacion/deudores": styles.actionToneSky,
  "/admin/archivos": styles.actionToneGreenLight,
};

const ACTION_ICON_TONES: Record<string, string> = {
  "/admin/facturacion/nueva-factura": styles.actionIconBlue,
  "/admin/facturacion/deudores": styles.actionIconSky,
  "/admin/archivos": styles.actionIconGreen,
};

type DashboardActionLinkProps = {
  action: DashboardQuickLink;
};

export function DashboardActionLink({ action }: DashboardActionLinkProps) {
  const Icon = ACTION_ICONS[action.href] ?? ReceiptText;
  const toneClass = ACTION_TONES[action.href] ?? styles.actionToneBlueLight;
  const iconToneClass = ACTION_ICON_TONES[action.href] ?? styles.actionIconBlue;

  return (
    <Link
      href={action.href}
      className={`${styles.actionButton} ${toneClass}`}
    >
      <span className={`${styles.actionIcon} ${iconToneClass}`} aria-hidden>
        <Icon strokeWidth={ICON_STROKE} />
      </span>
      <span className={styles.actionLabel}>{action.label}</span>
    </Link>
  );
}
