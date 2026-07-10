"use client";

import { AdminTableSkeleton } from "@/features/admin/components/AdminTableSkeleton";
import { UserRoleBadge } from "@/features/users/components/UserRoleBadge";
import { UserStatusBadge } from "@/features/users/components/UserStatusBadge";
import type { UserListItem } from "@/features/users/types/user.types";
import { formatAdminDateTime } from "@/features/files/utils/format-admin-datetime";
import { ICON_STROKE, Pencil, UserRound, UserX } from "@/shared/icons";
import styles from "@/features/users/styles/UsersManager.module.scss";

type UsersTableProps = {
  users: UserListItem[];
  isLoading: boolean;
  error: string | null;
  currentUserId: string;
  busyUserId: string | null;
  onEdit: (user: UserListItem) => void;
  onToggleStatus: (user: UserListItem) => void;
  onCreateClick: () => void;
};

export function UsersTable({
  users,
  isLoading,
  error,
  currentUserId,
  busyUserId,
  onEdit,
  onToggleStatus,
  onCreateClick,
}: UsersTableProps) {
  if (isLoading) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de usuarios">
        <AdminTableSkeleton variant="users" label="Cargando usuarios…" rowCount={6} fillHeight />
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de usuarios">
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (users.length === 0) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de usuarios">
        <div className={styles.tableWrapEmpty}>
          <div className={styles.tableEmpty} role="status">
            <UserRound className={styles.tableEmptyIcon} strokeWidth={ICON_STROKE} aria-hidden />
            <p className={styles.tableEmptyText}>No hay usuarios que coincidan con los filtros.</p>
            <button type="button" className={styles.primaryButton} onClick={onCreateClick}>
              Crear primer usuario
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.tablePanel} aria-label="Listado de usuarios">
      <div className={styles.tableWrap}>
        <div className={styles.desktopTable}>
          <table className={styles.usersTable}>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Correo</th>
                <th scope="col">Rol</th>
                <th scope="col">Estado</th>
                <th scope="col">Último acceso</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isBusy = busyUserId === user.id;
                const isSelf = user.id === currentUserId;

                return (
                  <tr key={user.id}>
                    <td className={styles.nameCell}>{user.name}</td>
                    <td className={styles.emailCell}>{user.email}</td>
                    <td>
                      <UserRoleBadge role={user.role} />
                    </td>
                    <td>
                      <UserStatusBadge status={user.status} />
                    </td>
                    <td className={styles.metaCell}>
                      {formatAdminDateTime(user.lastAccessAt)}
                    </td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actionsGroup}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => onEdit(user)}
                          aria-label={`Editar ${user.name}`}
                          disabled={isBusy}
                        >
                          <Pencil strokeWidth={ICON_STROKE} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={styles.iconButtonDanger}
                          onClick={() => onToggleStatus(user)}
                          aria-label={
                            user.status === "ACTIVE"
                              ? `Desactivar ${user.name}`
                              : `Activar ${user.name}`
                          }
                          disabled={isBusy || (user.status === "ACTIVE" && isSelf)}
                          title={
                            isSelf && user.status === "ACTIVE"
                              ? "No podés desactivar tu propia cuenta"
                              : undefined
                          }
                        >
                          <UserX strokeWidth={ICON_STROKE} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.mobileList}>
          {users.map((user) => {
            const isBusy = busyUserId === user.id;
            const isSelf = user.id === currentUserId;

            return (
              <article key={user.id} className={styles.userCard}>
                <div className={styles.userCardHeader}>
                  <div>
                    <h2 className={styles.userCardName}>{user.name}</h2>
                    <p className={styles.userCardEmail}>{user.email}</p>
                  </div>
                  <UserStatusBadge status={user.status} />
                </div>
                <div className={styles.userCardMeta}>
                  <div>
                    <UserRoleBadge role={user.role} />
                  </div>
                  <div>Último acceso: {formatAdminDateTime(user.lastAccessAt)}</div>
                </div>
                <div className={styles.userCardActions}>
                  <button
                    type="button"
                    className={styles.cardActionButton}
                    onClick={() => onEdit(user)}
                    disabled={isBusy}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className={styles.cardActionButtonDanger}
                    onClick={() => onToggleStatus(user)}
                    disabled={isBusy || (user.status === "ACTIVE" && isSelf)}
                  >
                    {user.status === "ACTIVE" ? "Desactivar" : "Activar"}
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
