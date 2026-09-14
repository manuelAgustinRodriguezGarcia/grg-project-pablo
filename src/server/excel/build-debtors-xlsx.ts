import ExcelJS from "exceljs";
import type { ClientDebtItem } from "@/features/billing/utils/invoice-list";

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export async function buildDebtorsXlsx(
  debtors: ClientDebtItem[],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Clientes con deuda", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  sheet.addRow(["CLIENTES CON DEUDA"]);
  sheet.addRow(["Rothamel Repuestos S.H"]);
  sheet.addRow([]);
  sheet.addRow([
    "Código",
    "Cliente",
    "CUIT/DNI",
    "WhatsApp",
    "Email",
    "Facturas pendientes",
    "Total adeudado",
    "Última factura pendiente",
    "Fecha de última deuda",
  ]);

  for (const debtor of debtors) {
    sheet.addRow([
      debtor.code,
      debtor.name,
      debtor.identification ?? "",
      debtor.whatsapp ?? "",
      debtor.email ?? "",
      debtor.invoicesCount,
      debtor.outstanding,
      debtor.lastPendingInvoiceNumber ?? "",
      debtor.lastPendingInvoiceDate
        ? DATE_FORMATTER.format(new Date(debtor.lastPendingInvoiceDate))
        : "",
    ]);
  }

  const totalOutstanding = debtors.reduce(
    (sum, debtor) => sum + debtor.outstanding,
    0,
  );
  const pendingInvoices = debtors.reduce(
    (sum, debtor) => sum + debtor.invoicesCount,
    0,
  );
  sheet.addRow([]);
  sheet.addRow([
    "Totales",
    `${debtors.length} clientes`,
    "",
    "",
    "",
    pendingInvoices,
    totalOutstanding,
    "",
    "",
  ]);

  const headerRow = sheet.getRow(4);
  headerRow.font = { bold: true };
  sheet.getColumn(7).numFmt = '#,##0.00';
  sheet.columns.forEach((column) => {
    column.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
