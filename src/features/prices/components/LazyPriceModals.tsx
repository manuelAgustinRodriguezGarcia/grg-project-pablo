"use client";

import dynamic from "next/dynamic";

export const LazyPriceItemFormModal = dynamic(
  () =>
    import("@/features/prices/components/PriceItemFormModal").then((module) => ({
      default: module.PriceItemFormModal,
    })),
  { ssr: false },
);

export const LazyPriceListFormModal = dynamic(
  () =>
    import("@/features/prices/components/PriceListFormModal").then((module) => ({
      default: module.PriceListFormModal,
    })),
  { ssr: false },
);

export const LazyPriceSupplierEditModal = dynamic(
  () =>
    import("@/features/prices/components/PriceSupplierEditModal").then(
      (module) => ({
        default: module.PriceSupplierEditModal,
      }),
    ),
  { ssr: false },
);
