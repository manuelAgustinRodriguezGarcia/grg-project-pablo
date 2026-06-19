import Link from "next/link";
import { LOGIN_PATH } from "../data/landingData";
import landingStyles from "../styles/landing.module.scss";
import { RothamelLogo } from "./RothamelLogo";
import styles from "./LandingHeader.module.scss";

export function LandingHeader() {
  return (
    <header
      className={`${styles.header} ${landingStyles.animateFadeIn}`}
    >
      <div className={`${landingStyles.container} ${styles.inner}`}>
        <Link href="/" className={styles.logoLink} aria-label="Ir al inicio">
          <RothamelLogo />
        </Link>

        <Link href={LOGIN_PATH} className={styles.loginButton}>
          <span>Iniciar Sesión</span>
        </Link>
      </div>
    </header>
  );
}
