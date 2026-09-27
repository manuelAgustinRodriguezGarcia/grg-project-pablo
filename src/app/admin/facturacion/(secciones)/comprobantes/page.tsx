import { redirect } from "next/navigation";

export default function FacturacionComprobantesRedirectPage() {
  redirect("/admin/facturacion/facturas");
}
