"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Banknote, ChevronDown, ChevronUp, EllipsisVertical, Pencil, ICON_STROKE } from "@/shared/icons";
import type { PriceItemTableColumn } from "@/features/prices/types/price-item-table.types";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type PriceColumnHeaderCellProps = {
  column: PriceItemTableColumn;
  isAdmin: boolean;
  isSticky?: boolean;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onEdit: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
};

function formatHeaderLines(displayName: string): string[] {
  const normalized = displayName.replace(/\r\n/g, "\n").trim();
  if (normalized.includes("\n")) {
    return normalized
      .split("\n")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [normalized];
}

export function PriceColumnHeaderCell({
  column,
  isAdmin,
  isSticky = false,
  canMoveLeft = false,
  canMoveRight = false,
  onEdit,
  onMoveLeft,
  onMoveRight,
}: PriceColumnHeaderCellProps) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const headerLines = formatHeaderLines(column.displayName);

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

  const thClassName = [
    column.isPrice ? styles.priceHeaderPrice : "",
    isSticky ? styles.stickyCodeColumn : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <th scope="col" className={thClassName || undefined}>
      <div className={styles.tableHeaderInner}>
        <span className={styles.tableHeaderLabel}>
          {column.isPrice ? (
            <Banknote
              strokeWidth={ICON_STROKE}
              aria-hidden
              style={{ width: "0.85rem", height: "0.85rem", marginBottom: "0.15rem" }}
            />
          ) : null}
          {headerLines.map((line, index) => (
            <span key={`${column.id}-${index}`} className={styles.tableHeaderLine}>
              {line}
            </span>
          ))}
        </span>

        {isAdmin ? (
          <div ref={menuRef} className={styles.tableHeaderMenuWrap}>
            <button
              type="button"
              className={styles.tableHeaderMenuTrigger}
              aria-label={`Opciones de columna ${column.displayName}`}
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
                    onClick={() => {
                      setIsOpen(false);
                      onEdit();
                    }}
                  >
                    <Pencil strokeWidth={ICON_STROKE} aria-hidden />
                    <span>Editar columna</span>
                  </button>
                </li>
                {canMoveLeft && onMoveLeft ? (
                  <li role="none">
                    <button
                      type="button"
                      className={styles.tableHeaderMenuItem}
                      role="menuitem"
                      onClick={() => {
                        setIsOpen(false);
                        onMoveLeft();
                      }}
                    >
                      <ChevronUp strokeWidth={ICON_STROKE} aria-hidden />
                      <span>Mover a la izquierda</span>
                    </button>
                  </li>
                ) : null}
                {canMoveRight && onMoveRight ? (
                  <li role="none">
                    <button
                      type="button"
                      className={styles.tableHeaderMenuItem}
                      role="menuitem"
                      onClick={() => {
                        setIsOpen(false);
                        onMoveRight();
                      }}
                    >
                      <ChevronDown strokeWidth={ICON_STROKE} aria-hidden />
                      <span>Mover a la derecha</span>
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </th>
  );
}
