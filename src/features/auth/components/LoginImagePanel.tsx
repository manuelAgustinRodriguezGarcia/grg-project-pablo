import sharedStyles from "../styles/loginShared.module.scss";
import styles from "./LoginImagePanel.module.scss";

const LOGIN_IMAGE_SRC = "/login/login.webp";

export function LoginImagePanel() {
  return (
    <div
      className={`${styles.panel} ${sharedStyles.animateFadeIn}`}
      aria-hidden="true"
    >
      <img
        className={styles.image}
        src={LOGIN_IMAGE_SRC}
        alt=""
        decoding="async"
      />
    </div>
  );
}
