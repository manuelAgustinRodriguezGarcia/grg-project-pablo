"use client";

import styles from "@/features/admin/styles/AdminTableSkeleton.module.scss";

type AdminTableSkeletonVariant = "catalog" | "files" | "prices";

type AdminTableSkeletonProps = {
  variant: AdminTableSkeletonVariant;
  label: string;
  rowCount?: number;
};

const CATALOG_COLUMN_COUNT = 5;
const FILES_COLUMN_COUNT = 8;

function ShimmerBar({
  className,
  width = "full",
}: {
  className?: string;
  width?: "full" | "medium" | "short" | "thumb";
}) {
  const widthClass =
    width === "full"
      ? styles.shimmerBarFull
      : width === "medium"
        ? styles.shimmerBarMedium
        : width === "short"
          ? styles.shimmerBarShort
          : styles.shimmerBarThumb;

  return (
    <div
      className={`${styles.shimmerBar} ${widthClass}${className ? ` ${className}` : ""}`}
      aria-hidden
    />
  );
}

function CatalogSkeleton({ label, rowCount }: { label: string; rowCount: number }) {
  return (
    <div
      className={styles.catalogTable}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className={styles.visuallyHidden}>{label}</span>

      <div className={styles.catalogHeaderRow} aria-hidden>
        <div className={`${styles.catalogHeaderCell} ${styles.catalogThumbCell}`}>
          <ShimmerBar width="thumb" />
        </div>
        {Array.from({ length: CATALOG_COLUMN_COUNT }).map((_, index) => (
          <div key={`header-${index}`} className={styles.catalogHeaderCell}>
            <ShimmerBar width={index % 2 === 0 ? "medium" : "short"} />
          </div>
        ))}
      </div>

      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className={styles.catalogDataRow} aria-hidden>
          <div className={`${styles.catalogDataCell} ${styles.catalogThumbCell}`}>
            <ShimmerBar width="thumb" />
          </div>
          {Array.from({ length: CATALOG_COLUMN_COUNT }).map((_, columnIndex) => (
            <div key={`cell-${rowIndex}-${columnIndex}`} className={styles.catalogDataCell}>
              <ShimmerBar width={columnIndex % 3 === 0 ? "full" : "medium"} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function FilesSkeleton({ label, rowCount }: { label: string; rowCount: number }) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <span className={styles.visuallyHidden}>{label}</span>

      <div className={styles.filesDesktop} aria-hidden>
        <div className={styles.filesHeaderRow}>
          {Array.from({ length: FILES_COLUMN_COUNT }).map((_, index) => (
            <div key={`files-header-${index}`} className={styles.filesHeaderCell}>
              <ShimmerBar width={index === 0 ? "medium" : "short"} />
            </div>
          ))}
        </div>

        {Array.from({ length: rowCount }).map((_, rowIndex) => (
          <div key={`files-row-${rowIndex}`} className={styles.filesDataRow}>
            {Array.from({ length: FILES_COLUMN_COUNT }).map((_, columnIndex) => (
              <div key={`files-cell-${rowIndex}-${columnIndex}`} className={styles.filesDataCell}>
                <ShimmerBar
                  width={
                    columnIndex === 0 ? "full" : columnIndex % 2 === 0 ? "medium" : "short"
                  }
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.filesMobile} aria-hidden>
        {Array.from({ length: Math.min(rowCount, 4) }).map((_, index) => (
          <article key={`files-card-${index}`} className={styles.filesCard}>
            <div className={styles.filesCardHeader}>
              <ShimmerBar width="full" />
              <ShimmerBar width="short" />
            </div>

            <div className={styles.filesCardMeta}>
              {Array.from({ length: 4 }).map((_, metaIndex) => (
                <div key={`files-meta-${index}-${metaIndex}`} className={styles.filesCardMetaItem}>
                  <ShimmerBar width="short" />
                  <ShimmerBar width="medium" />
                </div>
              ))}
            </div>

            <ShimmerBar width="full" className={styles.filesCardBlock} />
            <div className={styles.filesCardActions}>
              <ShimmerBar width="medium" />
              <ShimmerBar width="medium" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PricesSkeleton({ label, rowCount }: { label: string; rowCount: number }) {
  return (
    <div
      className={styles.pricesTable}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className={styles.visuallyHidden}>{label}</span>

      {Array.from({ length: rowCount }).map((_, index) => (
        <div key={`price-row-${index}`} className={styles.pricesRow} aria-hidden>
          <ShimmerBar width="full" />
        </div>
      ))}
    </div>
  );
}

export function AdminTableSkeleton({
  variant,
  label,
  rowCount = 6,
}: AdminTableSkeletonProps) {
  switch (variant) {
    case "catalog":
      return <CatalogSkeleton label={label} rowCount={rowCount} />;
    case "files":
      return <FilesSkeleton label={label} rowCount={rowCount} />;
    case "prices":
      return <PricesSkeleton label={label} rowCount={rowCount} />;
    default: {
      const exhaustiveCheck: never = variant;
      return exhaustiveCheck;
    }
  }
}
