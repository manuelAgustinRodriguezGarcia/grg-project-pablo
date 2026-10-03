import { describe, expect, it, vi } from "vitest";
import { acquireArcaTicketLock } from "@/server/arca/tickets/advisory-lock";
import { arcaTicketContext } from "@/server/arca/tickets/ticket.types";

vi.mock("@/server/database/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

describe("acquireArcaTicketLock", () => {
  it("toma pg_advisory_xact_lock con la identidad como parámetro", async () => {
    const context = arcaTicketContext({
      environment: "HOMOLOGACION",
      service: "wsfe",
      certificateFingerprint: "abc123fingerprint",
    });
    const values: unknown[] = [];
    const executeRaw = vi.fn((strings: TemplateStringsArray, ...bound: unknown[]) => {
      values.push(strings.join("?"), ...bound);
      return Promise.resolve(0);
    });

    await acquireArcaTicketLock({ $executeRaw: executeRaw }, context);

    const sql = String(values[0]);
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("hashtextextended");
    expect(sql).not.toContain(context);
    expect(values).toContain(context);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });
});

describe("withArcaTicketLock", () => {
  it("ejecuta el trabajo dentro de la transacción después del lock", async () => {
    const { prisma } = await import("@/server/database/prisma");
    const { withArcaTicketLock } = await import("@/server/arca/tickets/ticket-lock");
    const tx = {
      $executeRaw: vi.fn(() => Promise.resolve(0)),
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (task, options) => {
      expect(options).toMatchObject({ timeout: 45_000 });
      return task(tx as never);
    });

    const result = await withArcaTicketLock("HOMOLOGACION|wsfe|abc", async (db) => {
      expect(db).toBe(tx);
      return "ok";
    });

    expect(result).toBe("ok");
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
