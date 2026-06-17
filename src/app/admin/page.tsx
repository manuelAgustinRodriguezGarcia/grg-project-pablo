import { requireAuthOrRedirect } from "@/server/auth";

export default async function AdminPage() {
  const { profile } = await requireAuthOrRedirect("/admin");

  return (
    <main>
      <h1>Panel de administración</h1>
      <p>
        Sesión activa: {profile.name} ({profile.role})
      </p>
    </main>
  );
}
