import { describe, expect, it } from "vitest";
import { toAdminUiAuth } from "@/features/auth/types/admin-ui-auth";
import {
  adminUserFixture,
  usuarioUserFixture,
} from "../../../helpers/fixtures/user.fixture";

describe("toAdminUiAuth", () => {
  it("marca ADMINISTRADOR con canEdit e isAdmin", () => {
    const auth = toAdminUiAuth(adminUserFixture);

    expect(auth).toMatchObject({
      role: "ADMINISTRADOR",
      canEdit: true,
      isAdmin: true,
      currentUserId: adminUserFixture.id,
      canManageUsers: true,
    });
  });

  it("marca VISITANTE sin canEdit ni isAdmin (solo lectura)", () => {
    const auth = toAdminUiAuth(usuarioUserFixture);

    expect(auth).toMatchObject({
      role: "VISITANTE",
      canEdit: false,
      isAdmin: false,
      currentUserId: usuarioUserFixture.id,
      canManageUsers: false,
    });
  });
});
