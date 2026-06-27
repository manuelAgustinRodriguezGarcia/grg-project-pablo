import { RothamelLogo } from "./RothamelLogo";
import { LandingFooterSocial } from "./LandingFooterSocial";
import styles from "./LandingFooter.module.scss";

const GRG_LOGO_SRC = "/logo-grg.svg";
const GRG_LOGO_WIDTH = 998;
const GRG_LOGO_HEIGHT = 364;
const GRG_WEBSITE_URL = "https://www.grgsolutions.com.ar/";

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandGroup}>
          <RothamelLogo variant="footer" />
        </div>

        <LandingFooterSocial />
      </div>

      <div className={styles.bottomBar}>
        <p className={styles.copyright}>
          © 2026 Rothamel Repuestos S.H. Todos los derechos reservados.
        </p>

        <div className={styles.developer}>
          <span className={styles.developerLabel}>Desarrollado por</span>
          <a
            href={GRG_WEBSITE_URL}
            className={styles.grgLogoLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GRG Solutions — Desarrollo y diseño web"
          >
            <img
              src={GRG_LOGO_SRC}
              alt="GRG Solutions"
              width={GRG_LOGO_WIDTH}
              height={GRG_LOGO_HEIGHT}
              className={styles.grgLogo}
              decoding="async"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
