"use client";

import { useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import {
  useAdminSectionTransition,
  useReportAdminSectionReady,
} from "@/features/admin/components/AdminSectionTransition";
import { useUnsavedInvoiceDraft } from "@/features/billing/components/invoices/UnsavedInvoiceDraftContext";
import {
  billingClientHistoryHref,
  billingInvoiceDetailHref,
} from "@/features/billing/data/billingNav";
import { useBillingInvoicesQuery } from "@/features/billing/hooks/useBillingInvoicesQuery";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import {
  buildDebtorClients,
  filterDebtorClients,
  invoiceMatchesDateRange,
  type DebtorSortOrder,
} from "@/features/billing/utils/invoice-list";
import { CustomDatePicker } from "@/shared/components/CustomDatePicker";
import { CustomSelect } from "@/shared/components/CustomSelect";
import {
  Eye,
  FileSpreadsheet,
  FileText,
  ICON_STROKE,
  Printer,
  Search,
} from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type DeudoresManagerProps = {
  initialInvoices?: BillingInvoiceListItem[];
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function printDebtorsTable(title: string, html: string): void {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.append(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }

  doc.open();
  doc.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; }
      h1 { font-size: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #f3f3f3; }
      td.num { text-align: right; }
    </style>
  </head><body>${html}</body></html>`);
  doc.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  window.setTimeout(() => frame.remove(), 60_000);
}

export function DeudoresManager({
  initialInvoices = [],
}: DeudoresManagerProps) {
  const invoicesQuery = useBillingInvoicesQuery(initialInvoices);
  const sectionTransition = useAdminSectionTransition();
  const unsavedDraft = useUnsavedInvoiceDraft();
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<DebtorSortOrder>("desc");
  const [busy, setBusy] = useState<"xlsx" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useReportAdminSectionReady(true);

  function goToBillingHref(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (unsavedDraft?.interceptLeave(event, href, { exact: true })) {
      return;
    }

    sectionTransition?.beginNavigation(href, { exact: true });
  }

  const rangedInvoices = useMemo(
    () =>
      (invoicesQuery.data ?? []).filter((invoice) =>
        invoiceMatchesDateRange(invoice, fromDate, toDate),
      ),
    [fromDate, invoicesQuery.data, toDate],
  );

  const debtors = useMemo(
    () => filterDebtorClients(buildDebtorClients(rangedInvoices), query, sort),
    [query, rangedInvoices, sort],
  );

  const totalOutstanding = debtors.reduce(
    (sum, debtor) => sum + debtor.outstanding,
    0,
  );
  const pendingInvoices = debtors.reduce(
    (sum, debtor) => sum + debtor.invoicesCount,
    0,
  );

  async function downloadExcel(): Promise<void> {
    setBusy("xlsx");
    setError(null);
    try {
      const params = new URLSearchParams({
        query,
        from: fromDate,
        to: toDate,
        sort,
      });
      const response = await fetch(
        `/api/admin/billing/deudores/xlsx?${params.toString()}`,
        { credentials: "include" },
      );
      if (!response.ok) {
        throw new Error("No se pudo generar el Excel.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "Clientes-con-deuda.xlsx";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo descargar.",
      );
    } finally {
      setBusy(null);
    }
  }

  function printList(): void {
    const rows = debtors
      .map(
        (debtor) =>
          `<tr>
            <td>${debtor.code}</td>
            <td>${debtor.name}</td>
            <td class="num">${debtor.invoicesCount}</td>
            <td class="num">${formatArsExact(debtor.outstanding)}</td>
            <td>${
              debtor.lastPendingInvoiceDate
                ? DATE_FORMATTER.format(new Date(debtor.lastPendingInvoiceDate))
                : "—"
            }</td>
            <td>${debtor.lastPendingInvoiceNumber ?? "—"}</td>
          </tr>`,
      )
      .join("");
    printDebtorsTable(
      "Clientes con deuda",
      `<h1>Clientes con deuda — Rothamel Repuestos S.H</h1>
       <p>${debtors.length} clientes · ${pendingInvoices} facturas pendientes · Total ${formatArsExact(totalOutstanding)}</p>
       <table>
         <thead>
           <tr>
             <th>Código</th><th>Cliente</th><th>Pendientes</th>
             <th>Total adeudado</th><th>Fecha</th><th>Última factura</th>
           </tr>
         </thead>
         <tbody>${rows}</tbody>
       </table>`,
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.sectionIntro} aria-label="Clientes con deuda">
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderText}>
            <h2 className={styles.sectionTitle}>
              <FileText
                className={`${styles.sectionTitleIcon} ${styles.sectionTitleIconRed}`}
                strokeWidth={ICON_STROKE}
                aria-hidden
              />
              Clientes con deuda
            </h2>
            <p className={styles.debtorsOutstandingTotal}>
              <span className={styles.debtorsOutstandingAmount}>
                {debtors.length}
              </span>{" "}
              {debtors.length === 1 ? "cliente" : "clientes"} |{" "}
              <span className={styles.debtorsOutstandingAmount}>
                {pendingInvoices}
              </span>{" "}
              {pendingInvoices === 1 ? "factura" : "facturas"} | Total:{" "}
              <span className={styles.debtorsOutstandingAmount}>
                {formatArsExact(totalOutstanding)}
              </span>
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={printList}
            >
              <Printer strokeWidth={ICON_STROKE} aria-hidden />
              Imprimir
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                void downloadExcel();
              }}
              disabled={busy !== null}
            >
              {busy === "xlsx" ? (
                "Generando…"
              ) : (
                <>
                  <FileSpreadsheet strokeWidth={ICON_STROKE} aria-hidden />
                  Excel
                </>
              )}
            </button>
          </div>
        </div>
        <div className={styles.filtersRow}>
          <div className={styles.headerSearchWrap}>
            <Search
              className={styles.headerSearchIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            <input
              className={styles.headerSearch}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, código o CUIT/DNI"
              spellCheck={false}
            />
          </div>
          <div className={styles.filterDateField}>
            <CustomDatePicker
              value={fromDate}
              onChange={setFromDate}
              allowEmpty
              ariaLabel="Desde"
              placeholder="Desde"
              triggerClassName={styles.filterDateControl}
              max={toDate || undefined}
            />
          </div>
          <div className={styles.filterDateField}>
            <CustomDatePicker
              value={toDate}
              onChange={setToDate}
              allowEmpty
              ariaLabel="Hasta"
              placeholder="Hasta"
              triggerClassName={styles.filterDateControl}
              min={fromDate || undefined}
            />
          </div>
          <div className={styles.filterSelect}>
            <CustomSelect
              value={sort}
              onChange={(value) => setSort(value as DebtorSortOrder)}
              ariaLabel="Ordenar por deuda"
              options={[
                { value: "desc", label: "Mayor a menor" },
                { value: "asc", label: "Menor a mayor" },
              ]}
            />
          </div>
        </div>
      </section>

      {error ? (
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      ) : null}

      {debtors.length === 0 ? (
        <p className={styles.tableEmptyText}>
          No hay clientes con deuda para los filtros actuales.
        </p>
      ) : (
        <section className={styles.tablePanel} aria-label="Clientes con deuda">
          <div className={styles.tableWrap}>
            <table className={styles.clientsTable}>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Pendientes</th>
                  <th scope="col">Total adeudado</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Última factura</th>
                  <th scope="col" className={styles.actionsCell}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {debtors.map((debtor) => {
                  const lastInvoiceHref = debtor.lastPendingInvoiceNumber
                    ? billingInvoiceDetailHref(debtor.lastPendingInvoiceNumber)
                    : null;
                  const clientHistoryHref = billingClientHistoryHref(
                    debtor.clientId,
                  );

                  return (
                    <tr key={debtor.clientId}>
                      <td>{debtor.code}</td>
                      <td>{debtor.name}</td>
                      <td>{debtor.invoicesCount}</td>
                      <td className={styles.amountCell}>
                        {formatArsExact(debtor.outstanding)}
                      </td>
                      <td>
                        {debtor.lastPendingInvoiceDate
                          ? DATE_FORMATTER.format(
                              new Date(debtor.lastPendingInvoiceDate),
                            )
                          : "—"}
                      </td>
                      <td>
                        {lastInvoiceHref ? (
                          <Link
                            href={lastInvoiceHref}
                            className={styles.movementInvoiceLink}
                            onClick={(event) =>
                              goToBillingHref(event, lastInvoiceHref)
                            }
                          >
                            {debtor.lastPendingInvoiceNumber}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={styles.actionsCell}>
                        <div className={styles.actionsGroup}>
                          <span className={styles.rowActionWrap}>
                            <Link
                              href={clientHistoryHref}
                              className={`${styles.editActionButton} ${styles.iconActionButton}`}
                              aria-label={`Ver detalles de ${debtor.name}`}
                              onClick={(event) =>
                                goToBillingHref(event, clientHistoryHref)
                              }
                            >
                              <Eye strokeWidth={ICON_STROKE} aria-hidden />
                            </Link>
                            <span
                              className={styles.rowActionTooltip}
                              role="tooltip"
                            >
                              Detalles
                            </span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
