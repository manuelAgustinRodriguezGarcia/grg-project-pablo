import sharedStyles from "../styles/loginShared.module.scss";
import styles from "./LoginImagePanel.module.scss";

export function LoginImagePanel() {
  return (
    <div
      className={`${styles.panel} ${sharedStyles.animateFadeIn}`}
      aria-hidden="true"
    >
      <div className={styles.imageWrap}>
        <div className={styles.accentStripSide} />
      </div>
    </div>
  );
}
