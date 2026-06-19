import { WHATSAPP_URL } from "../data/landingData";
import landingStyles from "../styles/landing.module.scss";
import { WhatsAppIcon } from "@/shared/components/WhatsAppIcon";
import styles from "./HeroSection.module.scss";

export function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={`${landingStyles.container} ${styles.inner}`}>
        <div
          className={`${styles.content} ${landingStyles.animateSlideUp}`}
        >
          <h1 id="hero-heading" className={styles.heading}>
            Repuestos para vehículos pesados y camiones
          </h1>
          <p className={styles.description}>
            En Rothamel Repuestos brindamos atención personalizada para que pueda encontrar los repuestos que usted necesita.
          </p>
          <a
            href={WHATSAPP_URL}
            className={styles.cta}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contáctese con nosotros por WhatsApp"
          >
            <WhatsAppIcon className={styles.ctaIcon} />
            <span>Contáctese con nosotros</span>
          </a>
        </div>

        <div
          className={`${styles.visual} ${landingStyles.animateSlideUp} ${landingStyles.animateDelay1}`}
          aria-hidden="true"
        >
          <div className={styles.imagePanel}>
            <div className={styles.imageOverlay} />
          </div>
          <div className={styles.accentStripSide} />
        </div>
      </div>
    </section>
  );
}
