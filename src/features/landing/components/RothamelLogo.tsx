import Image from "next/image";
import { Cog, ICON_STROKE } from "@/shared/icons";
import styles from "./RothamelLogo.module.scss";

type RothamelLogoProps = {
  variant?: "header" | "footer";
};

export function RothamelLogo({ variant = "header" }: RothamelLogoProps) {
  const logoClass =
    variant === "footer" ? styles.logoFooter : styles.logoHeader;

  return (
    <div className={logoClass} aria-label="Rothamel Repuestos">
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

type RothamelLogoImageProps = {
  src: string;
  alt?: string;
  variant?: "header" | "footer";
};

export function RothamelLogoImage({
  src,
  alt = "Rothamel Repuestos",
  variant = "header",
}: RothamelLogoImageProps) {
  const logoClass =
    variant === "footer" ? styles.logoImageFooter : styles.logoImageHeader;

  return (
    <Image
      className={logoClass}
      src={src}
      alt={alt}
      width={variant === "footer" ? 160 : 140}
      height={48}
      priority={variant === "header"}
    />
  );
}
