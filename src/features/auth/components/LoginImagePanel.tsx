import {
  LOGIN_IMAGE_HEIGHT,
  LOGIN_IMAGE_SRC,
  LOGIN_IMAGE_WIDTH,
} from "../data/loginData";
import sharedStyles from "../styles/loginShared.module.scss";
import styles from "./LoginImagePanel.module.scss";

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
        width={LOGIN_IMAGE_WIDTH}
        height={LOGIN_IMAGE_HEIGHT}
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
}
