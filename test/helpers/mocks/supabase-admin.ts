import { vi } from "vitest";
import { getSupabaseAdminClient } from "@/server/storage/supabase-admin";

export function createSupabaseAdminMock() {
  return {
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "550e8400-e29b-41d4-a716-446655440003",
              email: "nuevo@example.com",
            },
          },
          error: null,
        }),
        updateUserById: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  };
}

export function setupSupabaseAdminMock(): ReturnType<typeof createSupabaseAdminMock> {
  const client = createSupabaseAdminMock();
  vi.mocked(getSupabaseAdminClient).mockReturnValue(
    client as unknown as ReturnType<typeof getSupabaseAdminClient>,
  );
  return client;
}
