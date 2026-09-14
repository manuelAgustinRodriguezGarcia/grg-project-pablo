export type BillingDocumentKind = "INVOICE" | "RECEIPT" | "NOTE";

export type BillingDocumentActivityKind = "printed" | "downloaded" | "shared";

export type BillingDocumentActivity = {
  printedAt: Date | null;
  downloadedAt: Date | null;
  sharedAt: Date | null;
};

export function applyDocumentActivity<T extends BillingDocumentActivity>(
  item: T,
  activity: BillingDocumentActivityKind,
  at: Date,
): T {
  switch (activity) {
    case "printed":
      return { ...item, printedAt: at };
    case "downloaded":
      return { ...item, downloadedAt: at };
    case "shared":
      return { ...item, sharedAt: at };
    default: {
      const exhaustive: never = activity;
      return exhaustive;
    }
  }
}

export function activityFieldForKind(
  activity: BillingDocumentActivityKind,
): keyof BillingDocumentActivity {
  switch (activity) {
    case "printed":
      return "printedAt";
    case "downloaded":
      return "downloadedAt";
    case "shared":
      return "sharedAt";
    default: {
      const exhaustive: never = activity;
      return exhaustive;
    }
  }
}
