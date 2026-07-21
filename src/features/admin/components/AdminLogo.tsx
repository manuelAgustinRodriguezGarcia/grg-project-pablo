import {
  ALT_LOGO_WHITE_SRC,
  LOGO_HEIGHT,
  LOGO_WHITE_SRC,
  LOGO_WIDTH,
} from "@/features/landing/data/landingData";
import styles from "./AdminLogo.module.scss";

const LOGO_ASPECT_RATIO = LOGO_WIDTH / LOGO_HEIGHT;

type AdminLogoProps = {
  isCollapsed?: boolean;
};

export function AdminLogo({ isCollapsed = false }: AdminLogoProps) {
  const src = isCollapsed ? ALT_LOGO_WHITE_SRC : LOGO_WHITE_SRC;
  const width = Math.round(44 * LOGO_ASPECT_RATIO);

  return (
    <div
      className={`${styles.logo} ${isCollapsed ? styles.logoCollapsed : ""}`}
    >
      <img
        className={styles.logoImage}
        src={src}
        alt="Rothamel Repuestos"
        width={isCollapsed ? 44 : width}
        height={44}
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
