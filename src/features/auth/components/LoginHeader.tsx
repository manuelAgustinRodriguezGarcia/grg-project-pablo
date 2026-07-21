import Link from "next/link";
import { RothamelLogo } from "@/features/landing/components/RothamelLogo";
import sharedStyles from "../styles/loginShared.module.scss";
import styles from "./LoginHeader.module.scss";

export function LoginHeader() {
  return (
    <header className={`${styles.header} ${sharedStyles.animateFadeIn}`}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logoLink} aria-label="Ir al inicio">
          <RothamelLogo variant="header" />
        </Link>
      </div>
    </header>
  );
}
