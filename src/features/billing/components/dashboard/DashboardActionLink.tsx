"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useBeginAdminSectionNavigation } from "@/features/admin/components/AdminSectionTransition";
import {
  BILLING_NEW_INVOICE_PATH,
  BILLING_NEW_INVOICE_SHORTCUT,
} from "@/features/billing/data/billingNav";
import { DASHBOARD_CREATE_CATALOG_HREF } from "@/features/billing/data/dashboardConstants";
import type { DashboardQuickLink } from "@/features/billing/data/dashboardTypes";
import { isTypingTarget } from "@/features/billing/hooks/useBillingModalKeyboard";
import { ICON_STROKE, ReceiptText, TableProperties, Wallet } from "@/shared/icons";
import styles from "@/features/billing/styles/Dashboard.module.scss";

const ACTION_ICONS: Record<string, LucideIcon> = {
  "/admin/facturacion/nueva-factura": ReceiptText,
  "/admin/facturacion/deudores": Wallet,
  [DASHBOARD_CREATE_CATALOG_HREF]: TableProperties,
};

const ACTION_TONES: Record<string, string> = {
  "/admin/facturacion/nueva-factura": styles.actionToneBlueLight,
  "/admin/facturacion/deudores": styles.actionToneSky,
  [DASHBOARD_CREATE_CATALOG_HREF]: styles.actionToneGreenLight,
};

const ACTION_ICON_TONES: Record<string, string> = {
  "/admin/facturacion/nueva-factura": styles.actionIconBlue,
  "/admin/facturacion/deudores": styles.actionIconSky,
  [DASHBOARD_CREATE_CATALOG_HREF]: styles.actionIconGreen,
};

type DashboardActionLinkProps = {
  action: DashboardQuickLink;
};

export function DashboardActionLink({ action }: DashboardActionLinkProps) {
  const Icon = ACTION_ICONS[action.href] ?? ReceiptText;
  const toneClass = ACTION_TONES[action.href] ?? styles.actionToneBlueLight;
  const iconToneClass = ACTION_ICON_TONES[action.href] ?? styles.actionIconBlue;
  const showShortcut = action.href === BILLING_NEW_INVOICE_PATH;
  const beginNavigation = useBeginAdminSectionNavigation();
  const router = useRouter();

  useEffect(() => {
    if (!showShortcut) {
      return;
    }

    function handleShortcut(event: KeyboardEvent) {
      if (event.key !== BILLING_NEW_INVOICE_SHORTCUT) {
        return;
      }

      if (
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        isTypingTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      beginNavigation(BILLING_NEW_INVOICE_PATH, { exact: true });
      router.push(BILLING_NEW_INVOICE_PATH);
    }

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [beginNavigation, router, showShortcut]);

  return (
    <Link
      href={action.href}
      className={`${styles.actionButton} ${toneClass}`}
      aria-keyshortcuts={showShortcut ? BILLING_NEW_INVOICE_SHORTCUT : undefined}
      onClick={() => beginNavigation(action.href, { exact: true })}
    >
      <span className={`${styles.actionIcon} ${iconToneClass}`} aria-hidden>
        <Icon strokeWidth={ICON_STROKE} />
      </span>
      <span className={styles.actionLabel}>{action.label}</span>
      {showShortcut ? (
        <kbd className={styles.actionShortcut} aria-hidden>
          {BILLING_NEW_INVOICE_SHORTCUT}
        </kbd>
      ) : null}
    </Link>
  );
}
