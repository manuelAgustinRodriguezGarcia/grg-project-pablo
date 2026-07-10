import { describe, expect, it } from "vitest";
import { toAdminUiAuth } from "@/features/auth/types/admin-ui-auth";
import {
  adminUserFixture,
  usuarioUserFixture,
  visualizacionUserFixture,
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

  it("marca USUARIO con canEdit y sin isAdmin", () => {
    const auth = toAdminUiAuth(usuarioUserFixture);

    expect(auth).toEqual({
      role: "USUARIO",
      canEdit: true,
      isAdmin: false,
      currentUserId: usuarioUserFixture.id,
    });
  });

  it("marca VISUALIZACION sin canEdit ni isAdmin", () => {
    const auth = toAdminUiAuth(visualizacionUserFixture);

    expect(auth).toEqual({
      role: "VISUALIZACION",
      canEdit: false,
      isAdmin: false,
      currentUserId: visualizacionUserFixture.id,
    });
  });
});
