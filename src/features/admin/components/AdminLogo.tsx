import { Cog, ICON_STROKE } from "@/shared/icons";
import styles from "./AdminLogo.module.scss";

export function AdminLogo() {
  return (
    <div className={styles.logo} aria-label="Rothamel Repuestos">
      <div className={styles.iconWrap} aria-hidden="true">
        <Cog className={styles.gearIcon} strokeWidth={ICON_STROKE} aria-hidden />
      </div>
      <div className={styles.textWrap}>
        <span className={styles.brandPrimary}>ROTHAMEL</span>
        <span className={styles.brandSecondary}>REPUESTOS</span>
      </div>
    </div>
  );
}
