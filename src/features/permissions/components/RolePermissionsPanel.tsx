import styles from "./RolePermissionsPanel.module.scss";
import type { RolePermissionItem } from "@/features/permissions/types/permission.types";

type RolePermissionsPanelProps = {
  items: RolePermissionItem[];
};

export function RolePermissionsPanel({ items }: RolePermissionsPanelProps) {
  const hasItems = items.length > 0;

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Control de acceso</p>
        <h1 className={styles.title}>Permisos del rol Usuario</h1>
        <p className={styles.lead}>
          Definí qué acciones pueden realizar los trabajadores. Los cambios
          aplican a todo el rol Usuario.
        </p>
      </header>

      <section
        className={styles.panel}
        aria-labelledby="role-permissions-heading"
      >
        <div className={styles.panelHead}>
          <h2 id="role-permissions-heading" className={styles.panelTitle}>
            Acciones configurables
          </h2>
          <span className={styles.count} aria-live="polite">
            {hasItems
              ? `${items.length} ${items.length === 1 ? "acción" : "acciones"}`
              : "Sin acciones"}
          </span>
        </div>

        {hasItems ? (
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id} className={styles.row}>
                <div className={styles.rowCopy}>
                  <span className={styles.rowLabel}>{item.permission.label}</span>
                  {item.permission.description ? (
                    <span className={styles.rowDescription}>
                      {item.permission.description}
                    </span>
                  ) : null}
                </div>
                <label className={styles.toggle}>
                  <span className={styles.srOnly}>
                    {item.enabled ? "Desactivar" : "Activar"}{" "}
                    {item.permission.label}
                  </span>
                  <input
                    type="checkbox"
                    className={styles.toggleInput}
                    checked={item.enabled}
                    disabled
                    readOnly
                    aria-disabled="true"
                  />
                  <span className={styles.toggleTrack} aria-hidden />
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.empty} role="status">
            <p className={styles.emptyTitle}>
              Todavía no hay acciones configurables
            </p>
            <p className={styles.emptyText}>
              Cuando se definan las acciones del rol Usuario, aparecerán aquí
              para habilitarlas o deshabilitarlas.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
