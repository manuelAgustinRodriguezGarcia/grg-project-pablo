import Link from "next/link";
import { Lock, LockOpen, ICON_STROKE } from "@/shared/icons";
import { LOGIN_PATH } from "../data/landingData";
import landingStyles from "../styles/landing.module.scss";
import { RothamelLogo } from "./RothamelLogo";
import styles from "./LandingHeader.module.scss";

export function LandingHeader() {
  return (
    <header
      className={`${styles.header} ${landingStyles.animateFadeIn}`}
    >
      <div className={styles.inner}>
        <Link href="/" className={styles.logoLink} aria-label="Ir al inicio">
          <RothamelLogo />
        </Link>

        <Link href={LOGIN_PATH} className={styles.loginButton}>
          <span className={styles.loginIconWrap} aria-hidden="true">
            <Lock className={styles.loginIconLock} strokeWidth={ICON_STROKE} />
            <LockOpen
              className={styles.loginIconLockOpen}
              strokeWidth={ICON_STROKE}
            />
          </span>
          <span>Iniciar Sesión</span>
        </Link>
      </div>
    </header>
  );
}
