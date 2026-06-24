"use client";

import { Info, ICON_STROKE } from "@/shared/icons";
import styles from "./ImportWizard.module.scss";

type ImportWizardStepContextHintProps = {
  text: string;
};

export function ImportWizardStepContextHint({ text }: ImportWizardStepContextHintProps) {
  return (
    <>
      <hr className={styles.headerContextDivider} aria-hidden />
      <div className={styles.headerContextHint}>
        <span className={styles.destinationHintIcon} aria-hidden>
          <Info strokeWidth={ICON_STROKE} />
        </span>
        <p className={styles.headerContextHintText}>{text}</p>
      </div>
    </>
  );
}
