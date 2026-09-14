"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { HERO_BANNER_IMAGES } from "../data/landingData";
import styles from "./HeroSection.module.scss";

const ROTATION_MS = 9000;

export function HeroBannerCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [canTransition, setCanTransition] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCanTransition(true);
    });
    for (const src of HERO_BANNER_IMAGES) {
      const image = new window.Image();
      image.src = src;
    }
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % HERO_BANNER_IMAGES.length);
    }, ROTATION_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div
      className={`${styles.bannerCarousel} ${canTransition ? styles.bannerCarouselReady : ""}`}
      aria-hidden="true"
    >
      {HERO_BANNER_IMAGES.map((src, index) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 900px) 100vw, 50vw"
          className={`${styles.bannerImage} ${index === activeIndex ? styles.bannerImageActive : ""}`}
          loading="eager"
          priority={index === 0}
          fetchPriority={index === 0 ? "high" : "auto"}
          draggable={false}
        />
      ))}
    </div>
  );
}
