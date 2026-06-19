import styles from "./AdminPlaceholder.module.scss";

const PLACEHOLDER_TEXT =
  "Siendo construido por el pedazo de chad de manualidades rawr🐺";

export function AdminPlaceholder() {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.text}>{PLACEHOLDER_TEXT}</p>
      </div>
    </div>
  );
}
