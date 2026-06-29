import type { Metadata } from "next";
import { PriceNavigator } from "@/features/prices/components/PriceNavigator";
import { listPriceListsAction } from "@/features/prices/actions/price-list.actions";
import { requireAuthOrRedirect } from "@/server/auth";

export const metadata: Metadata = {
  title: "Precios | Admin Rothamel Repuestos",
};

export default async function AdminPreciosPage() {
  const auth = await requireAuthOrRedirect("/admin");
  const listsResult = await listPriceListsAction();

  return (
    <PriceNavigator
      initialPriceLists={listsResult.success ? listsResult.data : []}
      isAdmin={auth.profile.role === "ADMIN"}
      loadError={listsResult.success ? null : listsResult.error}
    />
  );
}
