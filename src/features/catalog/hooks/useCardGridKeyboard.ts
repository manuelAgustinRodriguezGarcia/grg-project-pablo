"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

type UseCardGridKeyboardOptions = {
  itemCount: number;
  enabled?: boolean;
  onActivate: (index: number) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
};

export function useCardGridKeyboard({
  itemCount,
  enabled = true,
  onActivate,
  searchInputRef,
}: UseCardGridKeyboardOptions) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [columnCount, setColumnCount] = useState(1);

  useEffect(() => {
    setFocusedIndex((current) => {
      if (itemCount <= 0) {
        return 0;
      }
      return Math.min(current, itemCount - 1);
    });
  }, [itemCount]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }

    function measureColumns() {
      if (!grid) {
        return;
      }

      const cards = grid.querySelectorAll<HTMLElement>("[data-card-index]");
      if (cards.length < 2) {
        setColumnCount(1);
        return;
      }

      const firstTop = cards[0].offsetTop;
      let columns = 1;
      for (let index = 1; index < cards.length; index += 1) {
        if (cards[index].offsetTop !== firstTop) {
          break;
        }
        columns += 1;
      }
      setColumnCount(Math.max(1, columns));
    }

    measureColumns();
    const observer = new ResizeObserver(measureColumns);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [itemCount]);

  const focusCardAt = useCallback(
    (index: number) => {
      if (!enabled || itemCount <= 0) {
        return;
      }

      const nextIndex = Math.max(0, Math.min(index, itemCount - 1));
      setFocusedIndex(nextIndex);

      requestAnimationFrame(() => {
        const card = gridRef.current?.querySelector<HTMLElement>(
          `[data-card-index="${nextIndex}"]`,
        );
        if (!card) {
          return;
        }
        card.focus({ preventScroll: true });
        card.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    },
    [enabled, itemCount],
  );

  const handleSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (!enabled || itemCount <= 0) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        focusCardAt(0);
        return;
      }

      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();

        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          focusCardAt(itemCount - 1);
          return;
        }

        focusCardAt(0);
      }
    },
    [enabled, focusCardAt, itemCount],
  );

  const handleCardKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>, index: number) => {
      if (!enabled || itemCount <= 0) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate(index);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        searchInputRef?.current?.focus();
        return;
      }

      let nextIndex = index;

      switch (event.key) {
        case "ArrowRight":
          nextIndex = Math.min(itemCount - 1, index + 1);
          break;
        case "ArrowLeft":
          nextIndex = Math.max(0, index - 1);
          break;
        case "ArrowDown":
          nextIndex =
            index + columnCount < itemCount ? index + columnCount : index;
          break;
        case "ArrowUp":
          if (index - columnCount < 0) {
            event.preventDefault();
            searchInputRef?.current?.focus();
            return;
          }
          nextIndex = index - columnCount;
          break;
        default:
          return;
      }

      if (nextIndex === index) {
        return;
      }

      event.preventDefault();
      focusCardAt(nextIndex);
    },
    [
      columnCount,
      enabled,
      focusCardAt,
      itemCount,
      onActivate,
      searchInputRef,
    ],
  );

  const focusSearch = useCallback(() => {
    searchInputRef?.current?.focus();
  }, [searchInputRef]);

  return {
    gridRef,
    focusedIndex,
    focusCardAt,
    focusSearch,
    handleSearchKeyDown,
    handleCardKeyDown,
  };
}
