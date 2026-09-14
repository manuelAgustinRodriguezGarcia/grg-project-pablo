"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useBillingClientsQuery } from "@/features/billing/hooks/useBillingClientsQuery";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import {
  getInvoicePdfFile,
  invoicePdfFilename,
  sharePdfFile,
} from "@/features/billing/utils/invoice-pdf-client";
import {
  buildInvoiceShareCaption,
  buildInvoiceShareSubject,
  buildMailtoShareUrl,
  buildWhatsAppShareUrl,
  getEmailShareLabel,
  getWhatsAppShareLabel,
  resolveLiveClientContact,
  toWhatsAppDigits,
} from "@/features/billing/utils/invoice-share";
import { WhatsAppIcon } from "@/shared/components/WhatsAppIcon";
import { ICON_STROKE, Mail, Share2 } from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type InvoiceShareMenuProps = {
  invoice: BillingInvoiceListItem;
  variant?: "icon" | "button" | "footer";
  menuPlacement?: "down" | "up";
  disabled?: boolean;
  onShared?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
};

type ShareChannel = "whatsapp" | "email";

export function InvoiceShareMenu({
  invoice,
  variant = "icon",
  menuPlacement = "down",
  disabled = false,
  onShared,
  open: openProp,
  onOpenChange,
  triggerClassName,
}: InvoiceShareMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [busyChannel, setBusyChannel] = useState<ShareChannel | null>(null);
  const open = openProp ?? internalOpen;

  function setOpen(next: boolean | ((current: boolean) => boolean)): void {
    const resolved = typeof next === "function" ? next(open) : next;
    onOpenChange?.(resolved);
    if (openProp === undefined) {
      setInternalOpen(resolved);
    }
  }
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const clientsQuery = useBillingClientsQuery();
  const liveContact = resolveLiveClientContact(invoice, clientsQuery.data);
  const whatsappDigits = toWhatsAppDigits(liveContact.whatsapp);
  const email = liveContact.email?.trim() || null;
  const caption = buildInvoiceShareCaption(invoice);
  const subject = buildInvoiceShareSubject(invoice);
  const filename = invoicePdfFilename(invoice.invoiceNumber);
  const isSharing = busyChannel !== null;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  async function shareDocument(channel: ShareChannel): Promise<void> {
    if (isSharing) {
      return;
    }

    setBusyChannel(channel);
    try {
      const file = await getInvoicePdfFile(invoice.id, filename);
      const result = await sharePdfFile(file, subject, caption);
      if (result === "cancelled") {
        return;
      }

      if (result === "saved") {
        if (channel === "whatsapp" && whatsappDigits) {
          window.open(
            buildWhatsAppShareUrl(whatsappDigits, caption),
            "_blank",
            "noopener,noreferrer",
          );
        } else if (channel === "email" && email) {
          window.location.href = buildMailtoShareUrl(email, subject);
        }
      }

      onShared?.();
      setOpen(false);
    } catch {
      return;
    } finally {
      setBusyChannel(null);
    }
  }

  let shareButton: ReactNode;
  switch (variant) {
    case "footer":
      shareButton = (
        <button
          type="button"
          className={styles.invoiceFooterAction}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Compartir factura ${invoice.invoiceNumber}`}
          disabled={disabled || isSharing}
        >
          <Share2 strokeWidth={ICON_STROKE} aria-hidden />
          <span className={styles.invoiceActionLabel}>Compartir</span>
        </button>
      );
      break;
    case "icon":
      shareButton = (
        <span className={styles.rowActionWrap}>
          <button
            type="button"
            className={`${styles.editActionButton} ${styles.iconActionButton}`}
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={`Compartir factura ${invoice.invoiceNumber}`}
            disabled={disabled || isSharing}
          >
            <Share2 strokeWidth={ICON_STROKE} aria-hidden />
          </button>
          <span className={styles.rowActionTooltip} role="tooltip">
            Compartir
          </span>
        </span>
      );
      break;
    case "button":
      shareButton = (
        <button
          type="button"
          className={`${styles.cardActionButton}${
            triggerClassName ? ` ${triggerClassName}` : ""
          }`}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={disabled || isSharing}
        >
          <Share2 strokeWidth={ICON_STROKE} aria-hidden />
          Compartir
        </button>
      );
      break;
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }

  return (
    <div
      className={`${styles.shareMenuWrap} ${open ? styles.shareMenuWrapOpen : ""}`}
      ref={wrapRef}
    >
      {shareButton}

      {open ? (
        <div
          className={`${styles.shareMenu} ${
            menuPlacement === "up" ? styles.shareMenuUp : ""
          }`}
          role="menu"
        >
          <button
            type="button"
            className={styles.shareMenuItem}
            disabled={!whatsappDigits || isSharing}
            role="menuitem"
            onClick={() => {
              void shareDocument("whatsapp");
            }}
          >
            <WhatsAppIcon />
            {busyChannel === "whatsapp"
              ? "Preparando PDF…"
              : getWhatsAppShareLabel(liveContact.whatsapp)}
          </button>
          <button
            type="button"
            className={styles.shareMenuItem}
            disabled={!email || isSharing}
            role="menuitem"
            onClick={() => {
              void shareDocument("email");
            }}
          >
            <Mail strokeWidth={ICON_STROKE} aria-hidden />
            {busyChannel === "email"
              ? "Preparando PDF…"
              : getEmailShareLabel(liveContact.email)}
          </button>
        </div>
      ) : null}
    </div>
  );
}
