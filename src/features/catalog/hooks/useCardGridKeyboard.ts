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

function isArrowKey(key: string): boolean {
  return (
    key === "ArrowUp" ||
    key === "ArrowDown" ||
    key === "ArrowLeft" ||
    key === "ArrowRight"
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useCardGridKeyboard({
  itemCount,
  enabled = true,
  onActivate,
  searchInputRef,
}: UseCardGridKeyboardOptions) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [columnCount, setColumnCount] = useState(1);

  const focusedIndexRef = useRef(0);
  const columnCountRef = useRef(1);
  const itemCountRef = useRef(itemCount);
  const enabledRef = useRef(enabled);
  const onActivateRef = useRef(onActivate);

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  useEffect(() => {
    columnCountRef.current = columnCount;
  }, [columnCount]);

  useEffect(() => {
    itemCountRef.current = itemCount;
  }, [itemCount]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    onActivateRef.current = onActivate;
  }, [onActivate]);

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

  const focusCardAt = useCallback((index: number) => {
    if (!enabledRef.current || itemCountRef.current <= 0) {
      return;
    }

    const nextIndex = Math.max(
      0,
      Math.min(index, itemCountRef.current - 1),
    );
    focusedIndexRef.current = nextIndex;
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
  }, []);

  const moveFromIndex = useCallback((index: number, key: string) => {
    const count = itemCountRef.current;
    const columns = columnCountRef.current;
    let nextIndex = index;

    switch (key) {
      case "ArrowRight":
        nextIndex = Math.min(count - 1, index + 1);
        break;
      case "ArrowLeft":
        nextIndex = Math.max(0, index - 1);
        break;
      case "ArrowDown":
        nextIndex = index + columns < count ? index + columns : index;
        break;
      case "ArrowUp":
        nextIndex = index - columns >= 0 ? index - columns : index;
        break;
      default:
        return index;
    }

    return nextIndex;
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function onWindowKeyDown(event: KeyboardEvent) {
      if (!enabledRef.current || itemCountRef.current <= 0) {
        return;
      }

      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]')) {
        return;
      }

      const target = event.target;
      const inSearch = target === searchInputRef?.current;
      const inEditable = isEditableTarget(target);

      if (event.key === "Escape") {
        if (!inSearch && searchInputRef?.current) {
          event.preventDefault();
          searchInputRef.current.focus();
        }
        return;
      }

      if (event.key === "Enter") {
        if (inEditable && !inSearch) {
          return;
        }
        if (inSearch) {
          return;
        }
        event.preventDefault();
        onActivateRef.current(focusedIndexRef.current);
        focusCardAt(focusedIndexRef.current);
        return;
      }

      if (!isArrowKey(event.key)) {
        return;
      }

      if (inEditable && !inSearch) {
        return;
      }

      event.preventDefault();
      const nextIndex = moveFromIndex(focusedIndexRef.current, event.key);
      focusCardAt(nextIndex);
    }

    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [enabled, focusCardAt, moveFromIndex, searchInputRef]);

  const handleSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (!enabled || itemCount <= 0) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        focusCardAt(focusedIndexRef.current);
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
      }
    },
    [enabled, itemCount, onActivate, searchInputRef],
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
