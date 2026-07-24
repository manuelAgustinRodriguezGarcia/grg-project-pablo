"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CATEGORY_SHOWCASE_ITEMS,
  categoryWhatsAppUrl,
  type CategoryShowcaseItem,
} from "../data/landingData";
import { WhatsAppIcon } from "@/shared/components/WhatsAppIcon";
import { ICON_STROKE, X } from "@/shared/icons";
import styles from "./CategoryShowcase.module.scss";

const HISTORY_STATE_KEY = "categoryShowcaseModal";

type ModalPhase = "open" | "closing";

const preloadedImages = new Set<string>();

function preloadCategoryImage(src: string): Promise<void> {
  if (preloadedImages.has(src)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const image = new window.Image();
    const finish = () => {
      preloadedImages.add(src);
      resolve();
    };
    image.onload = finish;
    image.onerror = finish;
    image.src = src;
    if (image.complete) {
      finish();
    }
  });
}

function CategoryMedia({
  item,
  className,
  size,
}: {
  item: CategoryShowcaseItem;
  className?: string;
  size: number;
}) {
  const imageClasses = [
    styles.image,
    item.imageFit === "compact" ? styles.imageCompact : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={[styles.media, className].filter(Boolean).join(" ")}>
      <div className={styles.ring} aria-hidden />
      <img
        src={item.imageSrc}
        alt={item.imageAlt}
        className={imageClasses}
        width={size}
        height={size}
        decoding="sync"
        draggable={false}
      />
    </div>
  );
}

function CategoryModal({
  item,
  phase,
  onRequestClose,
  onClosed,
}: {
  item: CategoryShowcaseItem;
  phase: ModalPhase;
  onRequestClose: () => void;
  onClosed: () => void;
}) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onRequestClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onRequestClose]);

  useEffect(() => {
    if (phase !== "closing") {
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) {
      onClosed();
      return;
    }

    const fallback = window.setTimeout(onClosed, 350);
    return () => window.clearTimeout(fallback);
  }, [onClosed, phase]);

  const overlayStateClass =
    phase === "closing"
      ? styles.modalOverlayClosing
      : entered
        ? styles.modalOverlayOpen
        : null;
  const cardStateClass =
    phase === "closing"
      ? styles.modalCardClosing
      : entered
        ? styles.modalCardOpen
        : null;

  return createPortal(
    <div
      className={[styles.modalOverlay, overlayStateClass].filter(Boolean).join(" ")}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onRequestClose();
        }
      }}
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          phase === "closing" &&
          event.propertyName === "opacity"
        ) {
          onClosed();
        }
      }}
    >
      <div
        className={[styles.modalCard, cardStateClass].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className={styles.modalClose}
          onClick={onRequestClose}
          aria-label="Cerrar"
        >
          <X strokeWidth={ICON_STROKE} aria-hidden />
        </button>

        <CategoryMedia
          item={item}
          className={styles.modalMedia}
          size={320}
        />

        <h2 id={titleId} className={styles.modalTitle}>
          {item.title}
        </h2>

        <a
          href={categoryWhatsAppUrl(item.title)}
          className={styles.whatsappButton}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsAppIcon className={styles.whatsappIcon} />
          <span>Consultar por WhatsApp</span>
        </a>
      </div>
    </div>,
    document.body,
  );
}

export function CategoryShowcase() {
  const [activeItem, setActiveItem] = useState<CategoryShowcaseItem | null>(
    null,
  );
  const [phase, setPhase] = useState<ModalPhase>("open");
  const historyOwnedRef = useRef(false);
  const closingFromUiRef = useRef(false);

  const requestClose = useCallback(() => {
    setPhase((current) => {
      if (current === "closing") {
        return current;
      }
      return "closing";
    });

    if (historyOwnedRef.current) {
      closingFromUiRef.current = true;
      historyOwnedRef.current = false;
      window.history.back();
    }
  }, []);

  const handleClosed = useCallback(() => {
    setActiveItem(null);
    setPhase("open");
    closingFromUiRef.current = false;
  }, []);

  const openItem = useCallback(async (item: CategoryShowcaseItem) => {
    await preloadCategoryImage(item.imageSrc);
    setActiveItem(item);
    setPhase("open");
    window.history.pushState({ [HISTORY_STATE_KEY]: item.id }, "");
    historyOwnedRef.current = true;
  }, []);

  useEffect(() => {
    function handlePopState() {
      if (closingFromUiRef.current) {
        closingFromUiRef.current = false;
        return;
      }

      if (!historyOwnedRef.current) {
        return;
      }

      historyOwnedRef.current = false;
      setPhase("closing");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <section className={styles.section} aria-label="Líneas de productos">
      <ul className={styles.grid}>
        {CATEGORY_SHOWCASE_ITEMS.map((item) => (
          <li key={item.id} className={styles.item}>
            <button
              type="button"
              className={styles.trigger}
              onClick={() => {
                void openItem(item);
              }}
              onPointerEnter={() => {
                void preloadCategoryImage(item.imageSrc);
              }}
              aria-haspopup="dialog"
            >
              <CategoryMedia item={item} size={160} />
              <span className={styles.title}>{item.title}</span>
            </button>
          </li>
        ))}
      </ul>

      {activeItem ? (
        <CategoryModal
          item={activeItem}
          phase={phase}
          onRequestClose={requestClose}
          onClosed={handleClosed}
        />
      ) : null}
    </section>
  );
}
