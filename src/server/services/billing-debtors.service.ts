import { requirePermission } from "@/server/auth";
import { buildDebtorsXlsx } from "@/server/excel/build-debtors-xlsx";
import { billingInvoiceRepository } from "@/server/repositories/billing-invoice.repository";
import {
  buildDebtorClients,
  filterDebtorClients,
  invoiceMatchesDateRange,
  type DebtorSortOrder,
} from "@/features/billing/utils/invoice-list";
import { toBillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";

export class BillingDebtorsService {
  async generateXlsx(input: {
    query: string;
    fromDate: string;
    toDate: string;
    sort: DebtorSortOrder;
  }): Promise<{ bytes: Uint8Array; filename: string }> {
    await requirePermission("debts.read");
    const invoices = (await billingInvoiceRepository.findAllOrdered())
      .map(toBillingInvoiceListItem)
      .filter((invoice) =>
        invoiceMatchesDateRange(invoice, input.fromDate, input.toDate),
      );
    const debtors = filterDebtorClients(
      buildDebtorClients(invoices),
      input.query,
      input.sort,
    );
    const bytes = await buildDebtorsXlsx(debtors);
    return {
      bytes,
      filename: "Clientes-con-deuda.xlsx",
    };
  }
}

export const billingDebtorsService = new BillingDebtorsService();
