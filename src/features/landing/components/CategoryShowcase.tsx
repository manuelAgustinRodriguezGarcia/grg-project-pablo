import { CATEGORY_SHOWCASE_ITEMS } from "../data/landingData";
import styles from "./CategoryShowcase.module.scss";

export function CategoryShowcase() {
  return (
    <section className={styles.section} aria-label="Líneas de productos">
      <ul className={styles.grid}>
        {CATEGORY_SHOWCASE_ITEMS.map((item) => (
          <li key={item.id} className={styles.item}>
            <div className={styles.media}>
              <div className={styles.ring} aria-hidden />
              <img
                src={item.imageSrc}
                alt={item.imageAlt}
                className={
                  item.imageFit === "compact"
                    ? `${styles.image} ${styles.imageCompact}`
                    : styles.image
                }
                width={160}
                height={160}
                decoding="async"
                draggable={false}
              />
            </div>
            <p className={styles.title}>{item.title}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
