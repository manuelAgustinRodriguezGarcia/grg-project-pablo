import { redirect } from "next/navigation";
import { BILLING_LIBROS_IVA_PATH } from "@/features/billing/data/billingNav";

export default function LibroIvaResumenesRedirectPage() {
  redirect(BILLING_LIBROS_IVA_PATH);
}
