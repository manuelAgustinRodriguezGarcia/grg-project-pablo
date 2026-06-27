"use client";

import { useEffect, useId, useRef, useState } from "react";
import { setColumnVisibilityAction } from "@/features/catalog/actions/column.actions";
import type { ColumnListItem } from "@/features/catalog/types/column.types";
import { EllipsisVertical, Eye, EyeOff, Pencil, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ColumnHeaderCellProps = {
  column: ColumnListItem;
  headerLines: string[];
  isAdmin: boolean;
  onEdit: () => void;
  onColumnUpdated?: (column: ColumnListItem) => void;
};

export function ColumnHeaderCell({
  column,
  headerLines,
  isAdmin,
  onEdit,
  onColumnUpdated,
}: ColumnHeaderCellProps) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isVisibilityBusy, setIsVisibilityBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  async function handleToggleVisibility() {
    if (isVisibilityBusy) {
      return;
    }

    setIsVisibilityBusy(true);

    try {
      const result = await setColumnVisibilityAction({
        id: column.id,
        visible: !column.visibleToNormalUser,
      });

      if (result.success) {
        onColumnUpdated?.(result.data);
        setIsOpen(false);
      }
    } finally {
      setIsVisibilityBusy(false);
    }
  }

  function handleEdit() {
    setIsOpen(false);
    onEdit();
  }

  const visibilityLabel = column.visibleToNormalUser ? "Ocultar" : "Mostrar";
  const VisibilityIcon = column.visibleToNormalUser ? EyeOff : Eye;

  return (
    <th scope="col" className={styles.tableDataCell}>
      <div className={styles.tableHeaderInner}>
        <span className={styles.tableHeaderLabel}>
          {headerLines.map((line, lineIndex) => (
            <span key={`${column.id}-${lineIndex}`} className={styles.tableHeaderLine}>
              {line}
            </span>
          ))}
        </span>

        {isAdmin ? (
          <div ref={menuRef} className={styles.tableHeaderMenuWrap}>
            <button
              type="button"
              className={styles.tableHeaderMenuTrigger}
              aria-label="Opciones de columna"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              aria-controls={menuId}
              onClick={() => setIsOpen((open) => !open)}
            >
              <EllipsisVertical strokeWidth={ICON_STROKE} aria-hidden />
            </button>

            {isOpen ? (
              <ul id={menuId} className={styles.tableHeaderMenu} role="menu">
                <li role="none">
                  <button
                    type="button"
                    className={styles.tableHeaderMenuItem}
                    role="menuitem"
                    onClick={handleEdit}
                  >
                    <Pencil strokeWidth={ICON_STROKE} aria-hidden />
                    <span>Editar</span>
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    className={styles.tableHeaderMenuItem}
                    role="menuitem"
                    disabled={isVisibilityBusy}
                    onClick={handleToggleVisibility}
                  >
                    <VisibilityIcon strokeWidth={ICON_STROKE} aria-hidden />
                    <span>{isVisibilityBusy ? "Guardando…" : visibilityLabel}</span>
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </th>
  );
}
