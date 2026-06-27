import { RothamelLogo } from "@/features/landing/components/RothamelLogo";
import sharedStyles from "../styles/loginShared.module.scss";
import styles from "./LoginHeader.module.scss";

export function LoginHeader() {
  return (
    <header className={`${styles.header} ${sharedStyles.animateFadeIn}`}>
      <div className={styles.inner}>
        <RothamelLogo variant="header" />
      </div>
    </header>
  );
}
