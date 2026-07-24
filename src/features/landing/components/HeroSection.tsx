import { WHATSAPP_URL } from "../data/landingData";
import landingStyles from "../styles/landing.module.scss";
import { WhatsAppIcon } from "@/shared/components/WhatsAppIcon";
import { HeroBannerCarousel } from "./HeroBannerCarousel";
import styles from "./HeroSection.module.scss";

export function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={styles.inner}>
        <div
          className={`${styles.content} ${landingStyles.animateSlideUp}`}
        >
          <h1 id="hero-heading" className={styles.heading}>
            Repuestos pesados para camiones, acoplados y maquinaria agrícola
          </h1>
          <ul className={styles.highlights}>
            <li>Más de 40 años de experiencia a su servicio</li>
            <li>Amplio stock de marcas líderes</li>
            <li>La mejor solución para su vehículo</li>
          </ul>
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
      </div>

      <div
        className={`${styles.visual} ${landingStyles.animateSlideUp} ${landingStyles.animateDelay1}`}
      >
        <HeroBannerCarousel />
      </div>
    </section>
  );
}
