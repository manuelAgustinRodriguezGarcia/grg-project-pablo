"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
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

function isActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
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

function getScrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay"
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function getStickyTopInset(scroller: HTMLElement): number {
  let inset = 0;
  for (const child of scroller.children) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }
    if (getComputedStyle(child).position !== "sticky") {
      continue;
    }
    const top = Number.parseFloat(getComputedStyle(child).top) || 0;
    inset = Math.max(inset, child.getBoundingClientRect().height + top);
  }
  return inset;
}

function scrollCardIntoScroller(card: HTMLElement): void {
  const scroller = getScrollParent(card);
  if (!scroller) {
    card.scrollIntoView({ block: "nearest", inline: "nearest" });
    return;
  }

  const scrollerRect = scroller.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const visibleTop = scrollerRect.top + getStickyTopInset(scroller);
  const visibleBottom = scrollerRect.bottom;
  const pad = 8;

  if (cardRect.bottom > visibleBottom - pad) {
    scroller.scrollTop += cardRect.bottom - (visibleBottom - pad);
    return;
  }

  if (cardRect.top < visibleTop + pad) {
    scroller.scrollTop -= visibleTop + pad - cardRect.top;
  }
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
  const ignoreActivationUntilRef = useRef(0);
  const ignorePointerUntilRef = useRef(0);
  const activeArrowRef = useRef<string | null>(null);
  const pressedArrowsRef = useRef(new Set<string>());
  const focusFrameRef = useRef<number | null>(null);

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

  useLayoutEffect(() => {
    if (!enabled || itemCount <= 0) {
      return;
    }

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
        columnCountRef.current = 1;
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
      const nextColumns = Math.max(1, columns);
      columnCountRef.current = nextColumns;
      setColumnCount(nextColumns);
    }

    measureColumns();
    const observer = new ResizeObserver(measureColumns);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [enabled, itemCount]);

  const focusCardAt = useCallback(
    (index: number, options?: { fromPointer?: boolean }) => {
      if (!enabledRef.current || itemCountRef.current <= 0) {
        return;
      }

      if (
        options?.fromPointer &&
        performance.now() < ignorePointerUntilRef.current
      ) {
        return;
      }

      const nextIndex = Math.max(
        0,
        Math.min(index, itemCountRef.current - 1),
      );
      focusedIndexRef.current = nextIndex;
      setFocusedIndex(nextIndex);

      if (!options?.fromPointer) {
        ignorePointerUntilRef.current = performance.now() + 200;
      }

      if (focusFrameRef.current !== null) {
        cancelAnimationFrame(focusFrameRef.current);
      }

      focusFrameRef.current = requestAnimationFrame(() => {
        focusFrameRef.current = null;
        const card = gridRef.current?.querySelector<HTMLElement>(
          `[data-card-index="${nextIndex}"]`,
        );
        if (!card) {
          return;
        }
        card.focus({ preventScroll: true });
        scrollCardIntoScroller(card);
      });
    },
    [],
  );

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

  const shouldIgnoreActivation = useCallback(() => {
    return performance.now() < ignoreActivationUntilRef.current;
  }, []);

  useLayoutEffect(() => {
    if (!enabled) {
      ignoreActivationUntilRef.current = 0;
      activeArrowRef.current = null;
      pressedArrowsRef.current.clear();
      return;
    }

    ignoreActivationUntilRef.current = performance.now() + 250;

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
        if (event.defaultPrevented) {
          return;
        }
        if (inEditable && !inSearch) {
          return;
        }
        if (inSearch) {
          return;
        }
        if (shouldIgnoreActivation()) {
          event.preventDefault();
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
      pressedArrowsRef.current.add(event.key);

      if (activeArrowRef.current === null) {
        activeArrowRef.current = event.key;
      }

      if (event.key !== activeArrowRef.current) {
        return;
      }

      const nextIndex = moveFromIndex(
        focusedIndexRef.current,
        activeArrowRef.current,
      );
      focusCardAt(nextIndex);
    }

    function onWindowKeyUp(event: KeyboardEvent) {
      if (!isArrowKey(event.key)) {
        return;
      }

      pressedArrowsRef.current.delete(event.key);

      if (activeArrowRef.current !== event.key) {
        return;
      }

      const remaining = pressedArrowsRef.current.values().next();
      activeArrowRef.current = remaining.done ? null : remaining.value;
    }

    window.addEventListener("keydown", onWindowKeyDown);
    window.addEventListener("keyup", onWindowKeyUp);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
      window.removeEventListener("keyup", onWindowKeyUp);
      if (focusFrameRef.current !== null) {
        cancelAnimationFrame(focusFrameRef.current);
        focusFrameRef.current = null;
      }
    };
  }, [enabled, focusCardAt, moveFromIndex, searchInputRef, shouldIgnoreActivation]);

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

      if (isActivationKey(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        if (shouldIgnoreActivation()) {
          return;
        }
        onActivate(index);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        searchInputRef?.current?.focus();
      }
    },
    [enabled, itemCount, onActivate, searchInputRef, shouldIgnoreActivation],
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
