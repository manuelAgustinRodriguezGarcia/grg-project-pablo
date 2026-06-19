import Image from "next/image";
import { RothamelLogo } from "./RothamelLogo";
import { Camera, Share2, ICON_STROKE } from "@/shared/icons";
import styles from "./LandingFooter.module.scss";

const GRG_LOGO_SRC = "/logo-grg.png";
const GRG_WEBSITE_URL = "https://www.grgsolutions.com.ar/";

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandGroup}>
          <RothamelLogo variant="footer" />
        </div>

        <div className={styles.socialCol}>
          <a
            href="https://www.facebook.com/"
            className={styles.socialLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook de Rothamel Repuestos"
          >
            <Share2 className={styles.socialIcon} strokeWidth={ICON_STROKE} aria-hidden />
          </a>
          <a
            href="https://www.instagram.com/"
            className={styles.socialLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram de Rothamel Repuestos"
          >
            <Camera className={styles.socialIcon} strokeWidth={ICON_STROKE} aria-hidden />
          </a>
        </div>
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
            <Image
              src={GRG_LOGO_SRC}
              alt="GRG Solutions"
              width={75}
              height={75}
              className={styles.grgLogo}
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
