import {
  MAP_LOCATION,
  PHONE_DISPLAY,
  WHATSAPP_URL,
} from "../data/landingData";
import landingStyles from "../styles/landing.module.scss";
import { Clock, Map, MapPin, ICON_STROKE } from "@/shared/icons";
import { WhatsAppIcon } from "@/shared/components/WhatsAppIcon";
import styles from "./ContactSection.module.scss";

export function ContactSection() {
  const fullAddress = `${MAP_LOCATION.address}, ${MAP_LOCATION.city}`;

  return (
    <section
      className={`${styles.contactSection} ${landingStyles.animateFadeIn}`}
      aria-labelledby="contact-heading"
    >
      <div className={styles.container}>
        <header className={styles.sectionHeader}>
          <p className={styles.eyebrow}>ATENCIÓN PERSONALIZADA</p>
          <h2 id="contact-heading" className={styles.heading}>
            Contáctese con nosotros
          </h2>
          <p className={styles.supporting}>
            A su disposición de lunes a sábados para asesorarlo y ayudarlo a encontrar los repuestos que necesita.
          </p>
        </header>

        <div className={styles.contactGrid}>
          <div className={styles.topRow}>
            <article
              className={`${styles.contactCard} ${styles.whatsappCard} ${landingStyles.animateSlideUp}`}
            >
              <a
                href={WHATSAPP_URL}
                className={styles.whatsappCardLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Contáctenos por WhatsApp"
              />
              <div className={styles.cardContent}>
                <div
                  className={`${styles.cardIconWrap} ${styles.whatsappIconWrap}`}
                  aria-hidden="true"
                >
                  <WhatsAppIcon className={styles.cardIcon} />
                </div>

                <div className={`${styles.cardText} ${styles.whatsappCardText}`}>
                  <div className={styles.whatsappInfo}>
                    <h3 className={styles.cardTitle}>Atención por WhatsApp</h3>
                    <p className={styles.whatsappPhone}>{PHONE_DISPLAY}</p>
                  </div>
                  <a
                    href={WHATSAPP_URL}
                    className={styles.whatsappButton}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Contáctenos"
                  >
                    <WhatsAppIcon className={styles.whatsappButtonIcon} />
                    <span>Contáctenos</span>
                  </a>
                </div>
              </div>
            </article>

            <article
              className={`${styles.contactCard} ${styles.hoursCard} ${landingStyles.animateSlideUp} ${landingStyles.animateDelay1}`}
            >
              <div className={styles.cardContent}>
                <div className={styles.cardIconWrap} aria-hidden="true">
                  <Clock
                    className={styles.cardIcon}
                    strokeWidth={ICON_STROKE}
                    aria-hidden
                  />
                </div>

                <div className={styles.cardText}>
                  <h3 className={styles.cardTitle}>Horarios de atención</h3>
                  <div className={`${styles.infoBody} ${styles.hoursBody}`}>
                    <div className={styles.hoursBlock}>
                      <p className={styles.hoursDay}>Lunes a Viernes</p>
                      <p className={styles.hoursTime}>07:30 - 19:30</p>
                    </div>
                    <div className={styles.hoursBlock}>
                      <p className={styles.hoursDay}>Sábados</p>
                      <p className={styles.hoursTime}>07:30 - 12:30</p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <article
            className={`${styles.mapCard} ${landingStyles.animateSlideUp} ${landingStyles.animateDelay1}`}
            aria-label="Mapa de ubicación de Rothamel Repuestos"
          >
            <header className={styles.mapHeader}>
              <div className={styles.mapHeaderIconWrap} aria-hidden="true">
                <Map
                  className={styles.mapHeaderIcon}
                  strokeWidth={ICON_STROKE}
                  aria-hidden
                />
              </div>
              <div className={styles.mapHeaderText}>
                <h3 className={styles.mapTitle}>Dónde encontrarnos</h3>
                <p className={styles.mapBusinessName}>{MAP_LOCATION.name}</p>
                <p className={styles.mapAddress}>
                  <MapPin
                    className={styles.mapAddressIcon}
                    strokeWidth={ICON_STROKE}
                    aria-hidden
                  />
                  <span>{fullAddress}</span>
                </p>
                <a
                  href={MAP_LOCATION.mapsUrl}
                  className={styles.directionsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Cómo llegar
                </a>
              </div>
            </header>

            <div className={styles.mapEmbed}>
              <iframe
                src={MAP_LOCATION.embedSrc}
                className={styles.mapIframe}
                title={`Ubicación de ${MAP_LOCATION.name} — ${fullAddress}`}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
