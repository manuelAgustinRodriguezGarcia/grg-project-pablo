"use client";

import { AdminTableSkeleton } from "@/features/admin/components/AdminTableSkeleton";
import type { BillingClientListItem } from "@/features/billing/types/billing-client.types";
import {
  IVA_CONDITION_LABELS,
  IVA_CONDITION_SHORT_LABELS,
} from "@/features/billing/types/billing-client.types";
import {
  clientHasDebt,
  type ClientInvoiceSummary,
} from "@/features/billing/utils/invoice-list";
import { BookUser, Eye, ICON_STROKE, Pencil, Trash2 } from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type ClientsTableProps = {
  clients: BillingClientListItem[];
  invoiceSummaries: Map<string, ClientInvoiceSummary>;
  isLoading: boolean;
  error: string | null;
  busyClientId: string | null;
  onDetails: (client: BillingClientListItem) => void;
  onEdit: (client: BillingClientListItem) => void;
  onDelete: (client: BillingClientListItem) => void;
  onCreateClick: () => void;
};

function PaymentStatusBadge({ hasDebt }: { hasDebt: boolean }) {
  return (
    <span
      className={`${styles.statusBadge} ${
        hasDebt ? styles.statusBadgeDebt : styles.statusBadgeOk
      }`}
    >
      {hasDebt ? "Adeuda" : "Al día"}
    </span>
  );
}

export function ClientsTable({
  clients,
  invoiceSummaries,
  isLoading,
  error,
  busyClientId,
  onDetails,
  onEdit,
  onDelete,
  onCreateClick,
}: ClientsTableProps) {
  if (isLoading) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de clientes">
        <AdminTableSkeleton
          variant="users"
          label="Cargando clientes…"
          rowCount={6}
          fillHeight
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de clientes">
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (clients.length === 0) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de clientes">
        <div className={styles.tableWrapEmpty}>
          <div className={styles.tableEmpty} role="status">
            <BookUser
              className={styles.tableEmptyIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            <p className={styles.tableEmptyText}>
              No hay clientes que coincidan con los filtros.
            </p>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={onCreateClick}
            >
              Crear primer cliente
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.tablePanel} aria-label="Listado de clientes">
      <div className={styles.tableWrap}>
        <div className={styles.desktopTable}>
          <table className={styles.clientsTable}>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Cliente</th>
                <th scope="col">IVA</th>
                <th scope="col">Estado</th>
                <th scope="col" className={styles.actionsCell}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const isBusy = busyClientId === client.id;
                const hasDebt = clientHasDebt(invoiceSummaries, client.id);

                return (
                  <tr key={client.id}>
                    <td className={styles.codeCell}>{client.code}</td>
                    <td className={styles.nameCell}>{client.name}</td>
                    <td>
                      <span className={styles.ivaBadge}>
                        {IVA_CONDITION_LABELS[client.ivaCondition]}
                      </span>
                    </td>
                    <td>
                      <PaymentStatusBadge hasDebt={hasDebt} />
                    </td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actionsGroup}>
                        <span className={styles.rowActionWrap}>
                          <button
                            type="button"
                            className={`${styles.editActionButton} ${styles.iconActionButton}`}
                            onClick={() => onDetails(client)}
                            aria-label={`Ver detalles de ${client.name}`}
                            disabled={isBusy}
                          >
                            <Eye strokeWidth={ICON_STROKE} aria-hidden />
                          </button>
                          <span className={styles.rowActionTooltip} role="tooltip">
                            Detalles
                          </span>
                        </span>
                        <span className={styles.rowActionWrap}>
                          <button
                            type="button"
                            className={`${styles.editActionButton} ${styles.iconActionButton}`}
                            onClick={() => onEdit(client)}
                            aria-label={`Editar ${client.name}`}
                            disabled={isBusy}
                          >
                            <Pencil strokeWidth={ICON_STROKE} aria-hidden />
                          </button>
                          <span className={styles.rowActionTooltip} role="tooltip">
                            Editar
                          </span>
                        </span>
                        <span className={styles.rowActionWrap}>
                          <button
                            type="button"
                            className={`${styles.deleteActionButton} ${styles.iconActionButton}`}
                            onClick={() => onDelete(client)}
                            aria-label={`Eliminar ${client.name}`}
                            disabled={isBusy}
                          >
                            <Trash2 strokeWidth={ICON_STROKE} aria-hidden />
                          </button>
                          <span
                            className={`${styles.rowActionTooltip} ${styles.rowActionTooltipDanger}`}
                            role="tooltip"
                          >
                            Eliminar
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

        <div className={styles.mobileList}>
          {clients.map((client) => {
            const isBusy = busyClientId === client.id;
            const hasDebt = clientHasDebt(invoiceSummaries, client.id);

            return (
              <article key={client.id} className={styles.clientCard}>
                <div className={styles.clientCardHeader}>
                  <div>
                    <p className={styles.clientCardCode}>{client.code}</p>
                    <h2 className={styles.clientCardName}>{client.name}</h2>
                  </div>
                  <div className={styles.clientCardBadges}>
                    <PaymentStatusBadge hasDebt={hasDebt} />
                    <span
                      className={styles.ivaBadge}
                      title={IVA_CONDITION_LABELS[client.ivaCondition]}
                    >
                      {IVA_CONDITION_SHORT_LABELS[client.ivaCondition]}
                    </span>
                  </div>
                </div>
                <div className={styles.clientCardActions}>
                  <button
                    type="button"
                    className={styles.cardActionButton}
                    onClick={() => onDetails(client)}
                    disabled={isBusy}
                  >
                    <Eye strokeWidth={ICON_STROKE} aria-hidden />
                    <span>Detalles</span>
                  </button>
                  <button
                    type="button"
                    className={styles.cardActionButton}
                    onClick={() => onEdit(client)}
                    disabled={isBusy}
                  >
                    <Pencil strokeWidth={ICON_STROKE} aria-hidden />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    className={styles.cardActionButtonDanger}
                    onClick={() => onDelete(client)}
                    disabled={isBusy}
                  >
                    <Trash2 strokeWidth={ICON_STROKE} aria-hidden />
                    <span>Eliminar</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
