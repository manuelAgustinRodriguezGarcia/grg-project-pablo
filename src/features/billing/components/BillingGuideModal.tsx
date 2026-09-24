"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import type { UserRole } from "@/generated/prisma/client";
import {
  BILLING_GUIDE_CATEGORIES,
  filterBillingGuideCategories,
  findBillingGuideArticle,
  findBillingGuideCategory,
  type BillingGuideArticle,
  type BillingGuideCategory,
} from "@/features/billing/data/billingGuide";
import { ArrowLeft, ChevronRight, ICON_STROKE, X } from "@/shared/icons";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";
import styles from "@/features/billing/styles/BillingGuideModal.module.scss";

type BillingGuideModalProps = {
  userRole: UserRole;
  onClose: () => void;
};

type GuideScreen = "home" | "category" | "article";

const CLOSE_ANIMATION_MS = 180;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function emptyCategoryMessage(category: BillingGuideCategory): string {
  const source = findBillingGuideCategory(BILLING_GUIDE_CATEGORIES, category.id);
  if (!source || source.articles.length === 0) {
    return "Pronto vamos a agregar más preguntas acá.";
  }

  return "No hay artículos disponibles para tu usuario en esta sección.";
}

function GuideArticleBody({
  article,
  headingRef,
}: {
  article: BillingGuideArticle;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const ArticleIcon = article.icon;
  const steps = article.steps ?? [];
  const visualActions = article.visualActions ?? [];
  const infoBlocks = article.infoBlocks ?? [];

  return (
    <div className={styles.article}>
      <div className={styles.articleHero}>
        {ArticleIcon ? (
          <span className={styles.iconWrap} aria-hidden>
            <ArticleIcon className={styles.icon} strokeWidth={ICON_STROKE} />
          </span>
        ) : null}
        <div>
          <h3
            id="billing-guide-article-title"
            className={styles.articleTitle}
            ref={headingRef}
            tabIndex={-1}
          >
            {article.title}
          </h3>
          {article.introduction ? (
            <p className={styles.articleIntro}>{article.introduction}</p>
          ) : null}
        </div>
      </div>

      {steps.length > 0 ? (
        <ol className={styles.steps}>
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <li key={step.id} className={styles.step}>
                <span className={styles.stepIndex} aria-hidden>
                  {index + 1}
                </span>
                {StepIcon ? (
                  <span className={styles.stepIconWrap} aria-hidden>
                    <StepIcon strokeWidth={ICON_STROKE} />
                  </span>
                ) : null}
                <div className={styles.stepBody}>
                  {step.title ? (
                    <p className={styles.stepTitle}>{step.title}</p>
                  ) : null}
                  <p className={styles.stepText}>{step.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {visualActions.length > 0 ? (
        <div className={styles.visualActions} aria-hidden>
          {visualActions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <span key={action.id} className={styles.visualAction}>
                {ActionIcon ? <ActionIcon strokeWidth={ICON_STROKE} /> : null}
                {action.label}
              </span>
            );
          })}
        </div>
      ) : null}

      {infoBlocks.length > 0 ? (
        <div className={styles.infoBlocks}>
          {infoBlocks.map((block) => (
            <aside
              key={block.id}
              className={`${styles.infoBlock} ${
                block.tone === "warning" ? styles.infoBlockWarning : ""
              }`}
            >
              {block.title ? (
                <p className={styles.infoTitle}>{block.title}</p>
              ) : null}
              <p className={styles.infoText}>{block.text}</p>
            </aside>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BillingGuideModal({ userRole, onClose }: BillingGuideModalProps) {
  const categories = useMemo(
    () => filterBillingGuideCategories(userRole),
    [userRole],
  );
  const [screen, setScreen] = useState<GuideScreen>("home");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const selectedCategory = categoryId
    ? findBillingGuideCategory(categories, categoryId)
    : undefined;
  const selectedArticle =
    selectedCategory && articleId
      ? findBillingGuideArticle(selectedCategory, articleId)
      : undefined;

  const requestClose = useCallback(() => {
    if (isClosing) {
      return;
    }

    if (prefersReducedMotion()) {
      onClose();
      return;
    }

    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, CLOSE_ANIMATION_MS);
  }, [isClosing, onClose]);

  const goHome = useCallback(() => {
    setScreen("home");
    setCategoryId(null);
    setArticleId(null);
  }, []);

  const goBack = useCallback(() => {
    if (screen === "article") {
      setScreen("category");
      setArticleId(null);
      return;
    }

    if (screen === "category") {
      goHome();
    }
  }, [goHome, screen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [screen, categoryId, articleId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      if (screen === "home") {
        requestClose();
        return;
      }

      goBack();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goBack, requestClose, screen]);

  useEffect(() => {
    if (screen === "category" && !selectedCategory) {
      goHome();
    }

    if (screen === "article" && (!selectedCategory || !selectedArticle)) {
      if (selectedCategory) {
        setScreen("category");
        setArticleId(null);
        return;
      }

      goHome();
    }
  }, [goHome, screen, selectedArticle, selectedCategory]);

  const CategoryIcon = selectedCategory?.icon;
  const labelledBy =
    screen === "article"
      ? "billing-guide-article-title"
      : screen === "category"
        ? "billing-guide-category-title"
        : "billing-guide-title";

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`${modalStyles.modalOverlay} ${styles.overlay}${
        isClosing ? ` ${styles.overlayClosing}` : ""
      }`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        className={`${modalStyles.modalCard} ${styles.card}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <div className={styles.header}>
          <div className={styles.headerMain}>
            {screen !== "home" ? (
              <button
                type="button"
                className={styles.backButton}
                onClick={goBack}
                aria-label="Volver"
              >
                <ArrowLeft strokeWidth={ICON_STROKE} aria-hidden />
                <span>Volver</span>
              </button>
            ) : null}
            {screen === "home" ? (
              <div className={styles.headerCopy}>
                <h2
                  id="billing-guide-title"
                  className={styles.title}
                  ref={headingRef}
                  tabIndex={-1}
                >
                  Guía de Facturación
                </h2>
                <p className={styles.subtitle}>
                  Encontrá rápidamente cómo realizar las principales tareas del
                  sistema.
                </p>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={requestClose}
            aria-label="Cerrar"
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>

        <div className={styles.body}>
          {screen === "home" ? (
            <div className={styles.homeGrid}>
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={styles.topicCard}
                    onClick={() => {
                      setCategoryId(category.id);
                      setArticleId(null);
                      setScreen("category");
                    }}
                  >
                    <span className={styles.iconWrap} aria-hidden>
                      <Icon className={styles.icon} strokeWidth={ICON_STROKE} />
                    </span>
                    <span className={styles.topicBody}>
                      <span className={styles.topicTitle}>{category.title}</span>
                      <span className={styles.topicDescription}>
                        {category.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {screen === "category" && selectedCategory ? (
            <>
              <div className={styles.categoryHero}>
                <span className={styles.iconWrap} aria-hidden>
                  {CategoryIcon ? (
                    <CategoryIcon
                      className={styles.icon}
                      strokeWidth={ICON_STROKE}
                    />
                  ) : null}
                </span>
                <div className={styles.categoryHeroCopy}>
                  <h3
                    id="billing-guide-category-title"
                    className={styles.categoryTitle}
                    ref={headingRef}
                    tabIndex={-1}
                  >
                    {selectedCategory.title}
                  </h3>
                  <p className={styles.categoryDescription}>
                    {selectedCategory.description}
                  </p>
                </div>
              </div>
              {selectedCategory.articles.length > 0 ? (
                <ul className={styles.questionList}>
                  {selectedCategory.articles.map((article) => {
                    const ArticleIcon = article.icon ?? selectedCategory.icon;
                    return (
                      <li key={article.id}>
                        <button
                          type="button"
                          className={styles.questionButton}
                          onClick={() => {
                            setArticleId(article.id);
                            setScreen("article");
                          }}
                        >
                          <span className={styles.iconWrap} aria-hidden>
                            <ArticleIcon
                              className={styles.icon}
                              strokeWidth={ICON_STROKE}
                            />
                          </span>
                          <span className={styles.questionCopy}>
                            <span className={styles.questionTitle}>
                              {article.title}
                            </span>
                            {article.description ? (
                              <span className={styles.questionDescription}>
                                {article.description}
                              </span>
                            ) : null}
                          </span>
                          <ChevronRight
                            className={styles.questionChevron}
                            strokeWidth={ICON_STROKE}
                            aria-hidden
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className={styles.emptyState}>
                  <p className={styles.emptyText}>
                    {emptyCategoryMessage(selectedCategory)}
                  </p>
                </div>
              )}
            </>
          ) : null}

          {screen === "article" && selectedArticle ? (
            <GuideArticleBody
              article={selectedArticle}
              headingRef={headingRef}
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
