import { IVA_CONDITION_LABELS } from "@/features/billing/types/billing-client.types";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import {
  INVOICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/features/billing/types/billing-invoice.types";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import { formatInvoiceIdentification } from "@/features/billing/utils/invoice-list";

const SHARE_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function toWhatsAppDigits(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D+/g, "");
  if (digits.length < 8) {
    return null;
  }

  if (digits.startsWith("54")) {
    return digits;
  }

  return `54${digits}`;
}

export function getWhatsAppShareLabel(
  whatsapp: string | null | undefined,
): string {
  const trimmed = whatsapp?.trim();
  return trimmed ? `Enviar a ${trimmed}` : "Enviar por WhatsApp";
}

export function getEmailShareLabel(email: string | null | undefined): string {
  const trimmed = email?.trim();
  return trimmed ? `Enviar a ${trimmed}` : "Enviar por email";
}

export type ClientShareContact = {
  id: string;
  whatsapp: string | null;
  email: string | null;
};

export function resolveLiveClientContact(
  snapshot: {
    clientId: string | null;
    clientWhatsapp: string | null;
    clientEmail: string | null;
  },
  clients: readonly ClientShareContact[] | undefined,
): { whatsapp: string | null; email: string | null } {
  if (!snapshot.clientId || !clients || clients.length === 0) {
    return {
      whatsapp: snapshot.clientWhatsapp,
      email: snapshot.clientEmail,
    };
  }

  const live = clients.find((client) => client.id === snapshot.clientId);
  if (!live) {
    return {
      whatsapp: snapshot.clientWhatsapp,
      email: snapshot.clientEmail,
    };
  }

  return {
    whatsapp: live.whatsapp,
    email: live.email,
  };
}

export function buildInvoiceShareText(invoice: BillingInvoiceListItem): string {
  const identification = formatInvoiceIdentification(
    invoice.clientIdentificationType,
    invoice.clientIdentificationNumber,
  );
  const issuedAt = SHARE_DATE_FORMATTER.format(new Date(invoice.issuedAt));
  const lines = [
    "Rothamel Repuestos",
    `${INVOICE_TYPE_LABELS[invoice.invoiceType]} ${invoice.invoiceNumber}`,
    `Fecha: ${issuedAt}`,
    `Cliente: ${invoice.clientName}`,
  ];

  if (identification) {
    lines.push(identification);
  }

  lines.push(`IVA: ${IVA_CONDITION_LABELS[invoice.clientIvaCondition]}`);
  lines.push(`Pago: ${PAYMENT_METHOD_LABELS[invoice.paymentMethod]}`);
  lines.push(`Total: ${formatArsExact(invoice.totalVisualRounded)}`);

  if (invoice.environment === "MODO_PRUEBA") {
    lines.push("");
    lines.push("MODO PRUEBA - NO VALIDO COMO FACTURA FISCAL");
  }

  return lines.join("\n");
}

export function buildWhatsAppShareUrl(digits: string, text: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function buildMailtoShareUrl(
  email: string,
  subject: string,
  body?: string,
): string {
  const params = new URLSearchParams({ subject });
  if (body) {
    params.set("body", body);
  }

  return `mailto:${email}?${params.toString()}`;
}

export function buildInvoiceShareCaption(
  invoice: BillingInvoiceListItem,
): string {
  return `${INVOICE_TYPE_LABELS[invoice.invoiceType]} ${invoice.invoiceNumber}`;
}

export function buildInvoiceShareSubject(
  invoice: BillingInvoiceListItem,
): string {
  return `${INVOICE_TYPE_LABELS[invoice.invoiceType]} ${invoice.invoiceNumber} - Rothamel Repuestos`;
}
