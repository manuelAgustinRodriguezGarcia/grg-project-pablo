"use client";

import dynamic from "next/dynamic";

export const LazyProductFormModal = dynamic(
  () =>
    import("@/features/catalog/components/ProductFormModal").then((module) => ({
      default: module.ProductFormModal,
    })),
  { ssr: false },
);
