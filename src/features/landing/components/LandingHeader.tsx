import Link from "next/link";
import { CircleUserRound, Lock, LockOpen, ICON_STROKE } from "@/shared/icons";
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

        <Link
          href={LOGIN_PATH}
          className={styles.loginButton}
          aria-label="Iniciar sesión"
        >
          <span className={styles.loginDesktopContent}>
            <span className={styles.loginIconWrap} aria-hidden="true">
              <Lock className={styles.loginIconLock} strokeWidth={ICON_STROKE} />
              <LockOpen
                className={styles.loginIconLockOpen}
                strokeWidth={ICON_STROKE}
              />
            </span>
            <span>Iniciar Sesión</span>
          </span>
          <CircleUserRound
            className={styles.loginMobileIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden="true"
          />
        </Link>
      </div>
    </header>
  );
}
