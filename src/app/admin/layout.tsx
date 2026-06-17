import { requireAuthOrRedirect } from "@/server/auth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAuthOrRedirect("/admin");
  return children;
}
