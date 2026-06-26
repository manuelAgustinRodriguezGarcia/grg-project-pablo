import {
  LOGO_BLUE_SRC,
  LOGO_HEIGHT,
  LOGO_WHITE_SRC,
  LOGO_WIDTH,
} from "../data/landingData";
import styles from "./RothamelLogo.module.scss";

type RothamelLogoProps = {
  variant?: "header" | "footer";
};

const LOGO_ASPECT_RATIO = LOGO_WIDTH / LOGO_HEIGHT;

function getLogoDimensions(variant: "header" | "footer") {
  const height = variant === "footer" ? 52 : 72;

  return {
    width: Math.round(height * LOGO_ASPECT_RATIO),
    height,
  };
}

export function RothamelLogo({ variant = "header" }: RothamelLogoProps) {
  const src = variant === "footer" ? LOGO_WHITE_SRC : LOGO_BLUE_SRC;
  const logoClass =
    variant === "footer" ? styles.logoImageFooter : styles.logoImageHeader;
  const { width, height } = getLogoDimensions(variant);

  return (
    // SVG estático en /public: img directo evita problemas de tamaño con next/image.
    <img
      className={logoClass}
      src={src}
      alt="Rothamel Repuestos"
      width={width}
      height={height}
      decoding="async"
    />
  );
}
