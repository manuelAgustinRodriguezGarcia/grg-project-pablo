"use client";

import styles from "./ImportWizard.module.scss";

type ImportYesNoRadioProps = {
  name: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  yesDisabled?: boolean;
  yesLabel?: string;
  noLabel?: string;
};

export function ImportYesNoRadio({
  name,
  value,
  onChange,
  disabled = false,
  yesDisabled = false,
  yesLabel = "Sí",
  noLabel = "No",
}: ImportYesNoRadioProps) {
  return (
    <div className={styles.yesNoRadioGroup} role="radiogroup">
      <label
        className={styles.yesNoRadioOption}
        aria-disabled={disabled || yesDisabled}
      >
        <input
          type="radio"
          name={name}
          className={styles.yesNoRadioInput}
          checked={value}
          disabled={disabled || yesDisabled}
          onChange={() => onChange(true)}
        />
        <span>{yesLabel}</span>
      </label>
      <label className={styles.yesNoRadioOption}>
        <input
          type="radio"
          name={name}
          className={styles.yesNoRadioInput}
          checked={!value}
          disabled={disabled}
          onChange={() => onChange(false)}
        />
        <span>{noLabel}</span>
      </label>
    </div>
  );
}
