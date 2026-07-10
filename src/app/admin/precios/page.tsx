import type { Metadata } from "next";
import { toAdminUiAuth } from "@/features/auth/types/admin-ui-auth";
import { PriceNavigator } from "@/features/prices/components/PriceNavigator";
import { listPriceListsAction } from "@/features/prices/actions/price-list.actions";
import { requireAuthOrRedirect } from "@/server/auth";

export const metadata: Metadata = {
  title: "Precios | Admin Rothamel Repuestos",
};

type AdminPreciosPageProps = {
  searchParams: Promise<{
    list?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function AdminPreciosPage({
  searchParams,
}: AdminPreciosPageProps) {
  const auth = await requireAuthOrRedirect("/admin");
  const adminAuth = toAdminUiAuth(auth.profile);
  const params = await searchParams;
  const listsResult = await listPriceListsAction();

  return (
    <PriceNavigator
      initialPriceLists={listsResult.success ? listsResult.data : []}
      initialListId={firstParam(params.list)}
      canEdit={adminAuth.canEdit}
      isAdmin={adminAuth.isAdmin}
      loadError={listsResult.success ? null : listsResult.error}
    />
  );
}
