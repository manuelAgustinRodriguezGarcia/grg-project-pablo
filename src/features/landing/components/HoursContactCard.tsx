"use client";

import { useEffect, useState } from "react";
import { ICON_STROKE, Snowflake, Sun } from "@/shared/icons";
import styles from "./ContactSection.module.scss";

type Season = "summer" | "winter";

const SEASON_CYCLE_MS = 15_000;

function getDefaultSeason(date = new Date()): Season {
  const month = date.getMonth();
  // Hemisferio sur (Chaco): invierno aprox. mayo–agosto.
  return month >= 4 && month <= 7 ? "winter" : "summer";
}

function nextSeason(season: Season): Season {
  return season === "summer" ? "winter" : "summer";
}

type HoursContactCardProps = {
  className?: string;
};

export function HoursContactCard({ className }: HoursContactCardProps) {
  const [season, setSeason] = useState<Season>(getDefaultSeason);
  const [cycleId, setCycleId] = useState(0);
  const isSummer = season === "summer";
  const afternoonHours = isSummer ? "15:30 - 19:30" : "15:00 - 19:00";
  const seasonTitleSuffix = isSummer ? "(Verano)" : "(Invierno)";

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSeason((current) => nextSeason(current));
      setCycleId((current) => current + 1);
    }, SEASON_CYCLE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [cycleId]);

  function handleSeasonToggle() {
    setSeason((current) => nextSeason(current));
    setCycleId((current) => current + 1);
  }

  return (
    <article
      className={[
        styles.contactCard,
        styles.hoursCard,
        isSummer ? styles.hoursCardSummer : styles.hoursCardWinter,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.cardContent}>
        <button
          type="button"
          className={styles.seasonToggle}
          onClick={handleSeasonToggle}
          aria-label={
            isSummer
              ? "Cambiar a horarios de invierno"
              : "Cambiar a horarios de verano"
          }
        >
          {isSummer ? (
            <Sun
              className={styles.seasonToggleIcon}
              strokeWidth={ICON_STROKE}
            />
          ) : (
            <Snowflake
              className={styles.seasonToggleIcon}
              strokeWidth={ICON_STROKE}
            />
          )}
        </button>

        <div className={styles.cardText}>
          <h3 className={styles.cardTitle}>
            Horarios de Atención{" "}
            <span className={styles.seasonLabel}>{seasonTitleSuffix}</span>
          </h3>
          <div className={`${styles.infoBody} ${styles.hoursBody}`}>
            <div className={styles.hoursBlock}>
              <p className={styles.hoursDay}>
                Lunes a
                <br />
                Viernes
              </p>
              <div className={styles.hoursTimes}>
                <p className={styles.hoursTime}>07:30 - 12:00</p>
                <p className={styles.hoursTime}>{afternoonHours}</p>
              </div>
            </div>
            <div className={styles.hoursBlock}>
              <p className={styles.hoursDay}>Sábados</p>
              <p className={styles.hoursTime}>07:30 - 12:30</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
