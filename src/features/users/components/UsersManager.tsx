"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  useAdminSectionTransition,
  useReportAdminSectionReady,
} from "@/features/admin/components/AdminSectionTransition";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import {
  activateUserAction,
  createUserAction,
  deactivateUserAction,
  listUsersAction,
  updateUserAction,
} from "@/features/users/actions/user.actions";
import type { UserFormValues } from "@/features/users/components/UserFormModal";
import { UserFormModal } from "@/features/users/components/UserFormModal";
import { UsersPageIntro } from "@/features/users/components/UsersPageIntro";
import { UsersTable } from "@/features/users/components/UsersTable";
import type { UpdateUserInput } from "@/features/users/schemas/user.schemas";
import type { UserListItem } from "@/features/users/types/user.types";
import styles from "@/features/users/styles/UsersManager.module.scss";

type UsersManagerProps = {
  initialUsers: UserListItem[];
  currentUserId: string;
};

export function UsersManager({ initialUsers, currentUserId }: UsersManagerProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isFormBusy, setIsFormBusy] = useState(false);

  const [statusTarget, setStatusTarget] = useState<UserListItem | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: adminQueryKeys.users(roleFilter, query),
    queryFn: async (): Promise<UserListItem[]> => {
      const result = await listUsersAction();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    initialData: initialUsers,
    staleTime: 30_000,
  });

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");
    return (usersQuery.data ?? []).filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        user.name.toLocaleLowerCase("es-AR").includes(normalizedQuery) ||
        user.email.toLocaleLowerCase("es-AR").includes(normalizedQuery)
      );
    });
  }, [usersQuery.data, query, roleFilter]);

  const invalidateUsers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: adminQueryKeys.users() });
  }, [queryClient]);

  const handleOpenCreate = useCallback(() => {
    setActionError(null);
    setFormError(null);
    setEditingUser(null);
    setFormMode("create");
  }, []);

  const handleOpenEdit = useCallback((user: UserListItem) => {
    setActionError(null);
    setFormError(null);
    setEditingUser(user);
    setFormMode("edit");
  }, []);

  const handleCloseForm = useCallback(() => {
    if (isFormBusy) {
      return;
    }
    setFormMode(null);
    setEditingUser(null);
    setFormError(null);
  }, [isFormBusy]);

  const handleSubmitForm = useCallback(
    async (values: UserFormValues) => {
      setIsFormBusy(true);
      setFormError(null);

      try {
        if (formMode === "create") {
          const result = await createUserAction({
            name: values.name,
            email: values.email,
            role: values.role,
            password: values.password,
          });

          if (!result.success) {
            setFormError(result.error);
            return;
          }
        } else if (formMode === "edit" && editingUser) {
          const payload: UpdateUserInput = {
            id: editingUser.id,
            name: values.name,
            email: values.email,
            role: values.role,
            ...(values.password.trim().length > 0
              ? { password: values.password }
              : {}),
          };

          const result = await updateUserAction(payload);

          if (!result.success) {
            setFormError(result.error);
            return;
          }
        }

        await invalidateUsers();
        setFormMode(null);
        setEditingUser(null);
      } finally {
        setIsFormBusy(false);
      }
    },
    [editingUser, formMode, invalidateUsers],
  );

  const handleConfirmToggleStatus = useCallback(async () => {
    if (!statusTarget) {
      return;
    }

    setBusyUserId(statusTarget.id);
    setActionError(null);

    try {
      const result =
        statusTarget.status === "ACTIVE"
          ? await deactivateUserAction({ userId: statusTarget.id })
          : await activateUserAction({ userId: statusTarget.id });

      if (!result.success) {
        setActionError(result.error);
        return;
      }

      await invalidateUsers();
      setStatusTarget(null);
    } finally {
      setBusyUserId(null);
    }
  }, [invalidateUsers, statusTarget]);

  const listError =
    usersQuery.error instanceof Error ? usersQuery.error.message : null;
  const isLoading = usersQuery.isFetching && !usersQuery.data;

  const sectionTransition = useAdminSectionTransition();
  const hideInternalLoaders = sectionTransition?.isCoveringContent ?? false;
  const isSectionContentReady = !isLoading || Boolean(listError);
  useReportAdminSectionReady(isSectionContentReady);

  return (
    <>
      <div className={styles.page}>
        <div className={styles.body}>
          <UsersPageIntro
            query={query}
            roleFilter={roleFilter}
            onQueryChange={setQuery}
            onRoleFilterChange={setRoleFilter}
            onCreateClick={handleOpenCreate}
          />

          {actionError ? <p className={styles.inlineError}>{actionError}</p> : null}

          <UsersTable
            users={filteredUsers}
            isLoading={hideInternalLoaders ? false : isLoading}
            error={listError}
            currentUserId={currentUserId}
            busyUserId={busyUserId}
            onEdit={handleOpenEdit}
            onToggleStatus={setStatusTarget}
            onCreateClick={handleOpenCreate}
          />
        </div>
      </div>

      {formMode ? (
        <UserFormModal
          mode={formMode}
          initialUser={editingUser}
          isBusy={isFormBusy}
          error={formError}
          isSelf={editingUser?.id === currentUserId}
          onClose={handleCloseForm}
          onSubmit={(values) => void handleSubmitForm(values)}
        />
      ) : null}

      {statusTarget ? (
        <ConfirmDialog
          title={
            statusTarget.status === "ACTIVE" ? "Desactivar usuario" : "Activar usuario"
          }
          message={
            statusTarget.status === "ACTIVE"
              ? `¿Desactivar a ${statusTarget.name}? Perderá el acceso al panel.`
              : `¿Reactivar a ${statusTarget.name}?`
          }
          confirmLabel={statusTarget.status === "ACTIVE" ? "Desactivar" : "Activar"}
          variant={statusTarget.status === "ACTIVE" ? "danger" : "primary"}
          isBusy={busyUserId === statusTarget.id}
          onConfirm={() => void handleConfirmToggleStatus()}
          onCancel={() => {
            if (busyUserId !== statusTarget.id) {
              setStatusTarget(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
