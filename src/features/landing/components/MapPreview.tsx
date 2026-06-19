import { MAP_LOCATION } from "../data/landingData";
import landingStyles from "../styles/landing.module.scss";
import styles from "./MapPreview.module.scss";

type MapPreviewProps = {
  embedded?: boolean;
};

export function MapPreview({ embedded = false }: MapPreviewProps) {
  return (
    <section
      className={`${landingStyles.section} ${styles.section} ${embedded ? styles.embedded : ""}`}
      aria-label="Ubicación en el mapa"
    >
      <div
        className={
          embedded ? styles.embeddedInner : landingStyles.container
        }
      >
        <div
          className={`${styles.mapCard} ${landingStyles.animateSlideUp}`}
        >
          <iframe
            src={MAP_LOCATION.embedSrc}
            className={styles.mapIframe}
            title={`Ubicación de ${MAP_LOCATION.name} — ${MAP_LOCATION.address}, ${MAP_LOCATION.city}`}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}
