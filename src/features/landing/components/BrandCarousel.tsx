import type { Brand, BrandCarouselRow } from "../data/landingData";
import { BRAND_CAROUSEL_ROWS } from "../data/landingData";
import { BrandLogo } from "./BrandLogo";
import styles from "./BrandCarousel.module.scss";
import {
  buildSeamlessLoop,
  getScrollDurationSec,
  getSegmentRepeats,
} from "./brand-carousel.utils";

type BrandItemProps = {
  brand: Brand;
};

function BrandItem({ brand }: BrandItemProps) {
  return (
    <li className={styles.brandItem}>
      <BrandLogo brand={brand} />
    </li>
  );
}

type BrandRowCarouselProps = {
  row: BrandCarouselRow;
};

function BrandRowCarousel({ row }: BrandRowCarouselProps) {
  const segmentRepeats = getSegmentRepeats(row.brands.length);
  const loopBrands = buildSeamlessLoop(row.brands, segmentRepeats);
  const scrollDurationSec = getScrollDurationSec(row.brands, segmentRepeats);

  return (
    <div className={styles.carouselRow}>
      <div className={styles.carouselWrapper}>
        <div className={styles.fadeLeft} aria-hidden="true" />
        <div className={styles.fadeRight} aria-hidden="true" />
        <ul
          className={styles.track}
          aria-label="Marcas"
          style={
            {
              "--brand-scroll-duration": `${scrollDurationSec}s`,
            } as React.CSSProperties
          }
        >
          {loopBrands.map((brand, index) => (
            <BrandItem key={`${row.id}-${brand.name}-${index}`} brand={brand} />
          ))}
        </ul>
      </div>
    </div>
  );
}

export function BrandCarousel() {
  return (
    <section className={styles.section} aria-label="Marcas con las que trabajamos">
      <div className={styles.rows}>
        {BRAND_CAROUSEL_ROWS.map((row) => (
          <BrandRowCarousel key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}
