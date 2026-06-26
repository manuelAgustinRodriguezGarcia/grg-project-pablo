"use client";

import { useState } from "react";
import type { Brand } from "../data/landingData";
import styles from "./BrandCarousel.module.scss";

type BrandLogoProps = {
  brand: Brand;
};

export function BrandLogo({ brand }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={styles.brandLogoWrap}>
      {brand.logoSrc && !failed ? (
        <img
          src={brand.logoSrc}
          alt={brand.name}
          className={styles.brandImage}
          width={120}
          height={48}
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={styles.brandText}>{brand.name}</span>
      )}
      <span className={styles.brandTooltip} role="tooltip">
        {brand.name}
      </span>
    </div>
  );
}
