import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/server/auth/supabase-middleware";
import { middleware } from "@/middleware";

vi.mock("@/server/auth/supabase-middleware", () => ({
  updateSession: vi.fn(),
}));

function createRequest(pathname: string, search = ""): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${pathname}${search}`));
}

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateSession).mockResolvedValue({
      response: NextResponse.next(),
      user: null,
    });
  });

  it("redirige /admin al login sin sesión", async () => {
    const response = await middleware(createRequest("/admin"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/login");
    expect(response.headers.get("location")).toContain("redirectTo=%2Fadmin");
  });

  it("responde 401 en /api/admin sin sesión", async () => {
    const response = await middleware(createRequest("/api/admin/directory"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autenticado" });
  });

  it("redirige /auth/login a /admin si ya hay sesión", async () => {
    vi.mocked(updateSession).mockResolvedValue({
      response: NextResponse.next(),
      user: { id: "user-id" } as never,
    });

    const response = await middleware(createRequest("/auth/login"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin");
  });

  it("permite /auth/login sin sesión", async () => {
    const passthrough = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: passthrough,
      user: null,
    });

    const response = await middleware(createRequest("/auth/login"));

    expect(response).toBe(passthrough);
  });

  it("permite rutas públicas sin sesión", async () => {
    const passthrough = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: passthrough,
      user: null,
    });

    const response = await middleware(createRequest("/"));

    expect(response).toBe(passthrough);
  });
});
