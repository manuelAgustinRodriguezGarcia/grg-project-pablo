import ExcelJS from "exceljs";
import {
  debtorCuitColumnValue,
  type ClientDebtItem,
} from "@/features/billing/utils/invoice-list";

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
  sheet.addRow(["CUIT", "Cliente", "Total adeudado"]);

  for (const debtor of debtors) {
    sheet.addRow([
      debtorCuitColumnValue(debtor),
      debtor.name,
      debtor.outstanding,
    ]);
  }

  const totalOutstanding = debtors.reduce(
    (sum, debtor) => sum + debtor.outstanding,
    0,
  );
  sheet.addRow([]);
  sheet.addRow([
    "Totales",
    `${debtors.length} clientes`,
    totalOutstanding,
  ]);

  const headerRow = sheet.getRow(4);
  headerRow.font = { bold: true };
  sheet.getColumn(3).numFmt = '#,##0.00';
  sheet.columns.forEach((column) => {
    column.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
