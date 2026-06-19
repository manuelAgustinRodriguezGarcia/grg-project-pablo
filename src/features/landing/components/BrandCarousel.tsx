import Image from "next/image";
import type { Brand } from "../data/landingData";
import { BRANDS } from "../data/landingData";
import landingStyles from "../styles/landing.module.scss";
import styles from "./BrandCarousel.module.scss";

type BrandItemProps = {
  brand: Brand;
};

function BrandItem({ brand }: BrandItemProps) {
  return (
    <li className={styles.brandItem}>
      {brand.logoSrc ? (
        <Image
          src={brand.logoSrc}
          alt={brand.name}
          width={120}
          height={48}
          className={styles.brandImage}
        />
      ) : (
        <span className={styles.brandText}>{brand.name}</span>
      )}
    </li>
  );
}

export function BrandCarousel() {
  const loopBrands = [...BRANDS, ...BRANDS];

  return (
    <section className={styles.section} aria-label="Trabajamos con las mejores marcas">
      <div className={`${landingStyles.container} ${styles.header}`}>
        <h2 className={landingStyles.sectionTitle}>Trabajamos con las mejores marcas</h2>
      </div>

      <div className={styles.carouselWrapper}>
        <div className={styles.fadeLeft} aria-hidden="true" />
        <div className={styles.fadeRight} aria-hidden="true" />
        <ul className={styles.track}>
          {loopBrands.map((brand, index) => (
            <BrandItem key={`${brand.name}-${index}`} brand={brand} />
          ))}
        </ul>
      </div>
    </section>
  );
}
