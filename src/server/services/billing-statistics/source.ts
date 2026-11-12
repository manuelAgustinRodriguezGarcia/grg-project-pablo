export type StatisticsInvoiceItemRecord = {
  rubroId: string | null;
  rubroCode: string;
  rubroName: string;
  quantity: string;
  lineTotal: string;
  sortOrder: number;
};

export type StatisticsInvoiceRecord = {
  id: string;
  issuedAt: Date;
  invoiceNumber: string;
  clientId: string | null;
  clientCode: string;
  clientName: string;
  clientIdentificationType: string;
  clientIdentificationNumber: string | null;
  total: string;
  ivaAmount: string;
  totalVisualRounded: string;
  items: StatisticsInvoiceItemRecord[];
};

export type StatisticsNoteRecord = {
  id: string;
  kind: "CREDIT" | "DEBIT";
  issuedAt: Date;
  noteNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string | null;
  clientCode: string;
  clientName: string;
  clientIdentificationType: string;
  clientIdentificationNumber: string | null;
  netAmount: string;
  ivaAmount: string;
  amount: string;
};

export type StatisticsSource = {
  invoices: StatisticsInvoiceRecord[];
  notes: StatisticsNoteRecord[];
};

export const EMPTY_STATISTICS_SOURCE: StatisticsSource = {
  invoices: [],
  notes: [],
};
