import { describe, expect, it } from "vitest";
import { toAdminUiAuth } from "@/features/auth/types/admin-ui-auth";
import {
  adminUserFixture,
  usuarioUserFixture,
} from "../../../helpers/fixtures/user.fixture";

describe("toAdminUiAuth", () => {
  it("marca ADMIN con canEdit e isAdmin", () => {
    const auth = toAdminUiAuth(adminUserFixture);

    expect(auth).toEqual({
      role: "ADMIN",
      canEdit: true,
      isAdmin: true,
      currentUserId: adminUserFixture.id,
    });
  });

  it("marca USUARIO sin canEdit ni isAdmin (solo lectura)", () => {
    const auth = toAdminUiAuth(usuarioUserFixture);

    expect(auth).toEqual({
      role: "USUARIO",
      canEdit: false,
      isAdmin: false,
      currentUserId: usuarioUserFixture.id,
    });
  });
});
