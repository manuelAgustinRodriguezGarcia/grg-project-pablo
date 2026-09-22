"use client";

import { AdminTableSkeleton } from "@/features/admin/components/AdminTableSkeleton";
import type { BillingRubroListItem } from "@/features/billing/types/billing-rubro.types";
import { RUBRO_STATUS_LABELS } from "@/features/billing/types/billing-rubro.types";
import { Ban, ICON_STROKE, Pencil, Tags, Trash2 } from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type RubrosTableProps = {
  rubros: BillingRubroListItem[];
  isLoading: boolean;
  error: string | null;
  busyRubroId: string | null;
  onEdit?: (rubro: BillingRubroListItem) => void;
  onToggleStatus?: (rubro: BillingRubroListItem) => void;
  onDelete?: (rubro: BillingRubroListItem) => void;
  onCreateClick?: () => void;
};

export function RubrosTable({
  rubros,
  isLoading,
  error,
  busyRubroId,
  onEdit,
  onToggleStatus,
  onDelete,
  onCreateClick,
}: RubrosTableProps) {
  if (isLoading) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de rubros">
        <AdminTableSkeleton
          variant="users"
          label="Cargando rubros…"
          rowCount={6}
          fillHeight
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de rubros">
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (rubros.length === 0) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de rubros">
        <div className={styles.tableWrapEmpty}>
          <div className={styles.tableEmpty} role="status">
            <Tags
              className={styles.tableEmptyIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            <p className={styles.tableEmptyText}>
              No hay rubros que coincidan con los filtros.
            </p>
            {onCreateClick ? (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={onCreateClick}
              >
                Crear primer rubro
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.tablePanel} aria-label="Listado de rubros">
      <div className={styles.tableWrap}>
        <div className={styles.desktopTable}>
          <table className={styles.clientsTable}>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Rubro</th>
                <th scope="col">Estado</th>
                <th scope="col" className={styles.actionsCell}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {rubros.map((rubro) => {
                const isBusy = busyRubroId === rubro.id;
                const isActive = rubro.status === "ACTIVE";

                return (
                  <tr key={rubro.id}>
                    <td className={styles.codeCell}>{rubro.code}</td>
                    <td className={styles.nameCell}>{rubro.name}</td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          isActive
                            ? styles.statusBadgeOk
                            : styles.statusBadgeInactive
                        }`}
                      >
                        {RUBRO_STATUS_LABELS[rubro.status]}
                      </span>
                    </td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actionsGroup}>
                        {onEdit ? (
                          <span className={styles.rowActionWrap}>
                            <button
                              type="button"
                              className={`${styles.editActionButton} ${styles.iconActionButton}`}
                              onClick={() => onEdit(rubro)}
                              aria-label={`Editar ${rubro.name}`}
                              disabled={isBusy}
                            >
                              <Pencil strokeWidth={ICON_STROKE} aria-hidden />
                            </button>
                            <span className={styles.rowActionTooltip} role="tooltip">
                              Editar
                            </span>
                          </span>
                        ) : null}
                        {onToggleStatus ? (
                          <span className={styles.rowActionWrap}>
                            <button
                              type="button"
                              className={`${styles.toggleActionButton} ${styles.iconActionButton} ${
                                isActive
                                  ? styles.toggleActionButtonDanger
                                  : styles.toggleActionButtonSuccess
                              }`}
                              onClick={() => onToggleStatus(rubro)}
                              aria-label={`${isActive ? "Desactivar" : "Activar"} ${rubro.name}`}
                              disabled={isBusy}
                            >
                              <Ban strokeWidth={ICON_STROKE} aria-hidden />
                            </button>
                            <span
                              className={`${styles.rowActionTooltip} ${
                                isActive
                                  ? styles.rowActionTooltipDanger
                                  : styles.rowActionTooltipSuccess
                              }`}
                              role="tooltip"
                            >
                              {isActive ? "Desactivar" : "Activar"}
                            </span>
                          </span>
                        ) : null}
                        {onDelete ? (
                          <span className={styles.rowActionWrap}>
                            <button
                              type="button"
                              className={`${styles.deleteActionButton} ${styles.iconActionButton}`}
                              onClick={() => onDelete(rubro)}
                              aria-label={`Eliminar ${rubro.name}`}
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
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.mobileList}>
          {rubros.map((rubro) => {
            const isBusy = busyRubroId === rubro.id;
            const isActive = rubro.status === "ACTIVE";

            return (
              <article key={rubro.id} className={styles.clientCard}>
                <div className={styles.clientCardHeader}>
                  <div>
                    <p className={styles.clientCardCode}>{rubro.code}</p>
                    <h2 className={styles.clientCardName}>{rubro.name}</h2>
                  </div>
                  <div className={styles.clientCardBadges}>
                    <span
                      className={`${styles.statusBadge} ${
                        isActive
                          ? styles.statusBadgeOk
                          : styles.statusBadgeInactive
                      }`}
                    >
                      {RUBRO_STATUS_LABELS[rubro.status]}
                    </span>
                  </div>
                </div>
                <div className={styles.clientCardActions}>
                  {onEdit ? (
                    <button
                      type="button"
                      className={styles.cardActionButton}
                      onClick={() => onEdit(rubro)}
                      disabled={isBusy}
                    >
                      <Pencil strokeWidth={ICON_STROKE} aria-hidden />
                      <span>Editar</span>
                    </button>
                  ) : null}
                  {onToggleStatus ? (
                    <button
                      type="button"
                      className={`${styles.cardActionButton} ${
                        isActive
                          ? styles.cardActionButtonDanger
                          : styles.toggleActionButtonSuccess
                      }`}
                      onClick={() => onToggleStatus(rubro)}
                      disabled={isBusy}
                    >
                      <Ban strokeWidth={ICON_STROKE} aria-hidden />
                      <span>{isActive ? "Desactivar" : "Activar"}</span>
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      className={styles.cardActionButtonDanger}
                      onClick={() => onDelete(rubro)}
                      disabled={isBusy}
                    >
                      <Trash2 strokeWidth={ICON_STROKE} aria-hidden />
                      <span>Eliminar</span>
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
