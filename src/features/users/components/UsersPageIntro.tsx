"use client";

import { CustomSelect } from "@/shared/components/CustomSelect";
import { ICON_STROKE, Plus, Search } from "@/shared/icons";
import type { UserRole } from "@/generated/prisma/client";
import { USER_ROLE_LABELS } from "@/features/users/types/user.types";
import styles from "@/features/users/styles/UsersManager.module.scss";

type UsersPageIntroProps = {
  query: string;
  roleFilter: string;
  onQueryChange: (value: string) => void;
  onRoleFilterChange: (value: string) => void;
  onCreateClick: () => void;
};

const ROLE_FILTER_OPTIONS = [
  { value: "all", label: "Todos los roles" },
  ...(["ADMIN", "USUARIO"] as const).map((role) => ({
    value: role,
    label: USER_ROLE_LABELS[role as UserRole],
  })),
];

export function UsersPageIntro({
  query,
  roleFilter,
  onQueryChange,
  onRoleFilterChange,
  onCreateClick,
}: UsersPageIntroProps) {
  return (
    <section className={styles.sectionIntro} aria-label="Gestión de usuarios">
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Usuarios</h1>
        <div className={styles.headerActions}>
          <div className={styles.headerSearchWrap}>
            <Search
              className={styles.headerSearchIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            <input
              type="search"
              className={styles.headerSearch}
              placeholder="Buscar por nombre o correo…"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              aria-label="Buscar usuarios"
            />
          </div>
          <div className={styles.filterSelect}>
            <CustomSelect
              value={roleFilter}
              onChange={onRoleFilterChange}
              ariaLabel="Filtrar por rol"
              options={ROLE_FILTER_OPTIONS}
            />
          </div>
          <button type="button" className={styles.primaryButton} onClick={onCreateClick}>
            <Plus strokeWidth={ICON_STROKE} aria-hidden />
            Nuevo usuario
          </button>
        </div>
      </div>
    </section>
  );
}
