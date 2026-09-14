import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingPaymentMethod,
  BillingReceiptPaymentMethod,
} from "@/generated/prisma/client";

export type InvoicePdfIssuer = {
  name: string;
  cuit: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  ivaCondition: string | null;
  grossIncome: string | null;
  activitiesStartedAt: string | null;
};

export type InvoicePdfItem = {
  rubroCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type InvoicePdfInput = {
  invoiceType: BillingInvoiceType;
  invoiceNumber: string;
  pointOfSale: string;
  issuedAt: Date;
  environment: BillingFiscalEnvironment;
  clientName: string;
  clientCode: string;
  clientAddress: string | null;
  clientCity: string | null;
  clientProvince: string | null;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
  items: InvoicePdfItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  ivaPercent: number;
  ivaAmount: number;
  total: number;
  totalVisualRounded: number;
  paymentMethod: BillingPaymentMethod;
  notes: string | null;
  issuer: InvoicePdfIssuer;
  logoPng: Uint8Array | null;
};

export type ReceiptPdfAllocation = {
  invoiceNumber: string;
  invoiceType: BillingInvoiceType;
  amount: number;
};

export type ReceiptPdfInput = {
  receiptNumber: string;
  issuedAt: Date;
  amount: number;
  paymentMethod: BillingReceiptPaymentMethod;
  notes: string | null;
  createdByName: string;
  clientName: string;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  allocations: ReceiptPdfAllocation[];
  remainingAmount: number;
  issuer: InvoicePdfIssuer;
  logoPng: Uint8Array | null;
  environment: BillingFiscalEnvironment;
};
