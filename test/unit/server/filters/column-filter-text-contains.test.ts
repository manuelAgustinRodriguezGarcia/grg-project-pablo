import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { buildJsonTextContainsCondition } from "@/server/filters/column-filter-text-contains";

describe("buildJsonTextContainsCondition", () => {
  it("colapsa whitespace del query y compara contra el campo con espacios normalizados", () => {
    const sql = buildJsonTextContainsCondition("anclaje_frente", "TIPO  INDIEL");
    const compiled = sql.sql;
    const values = sql.values;

    expect(compiled).toContain("regexp_replace");
    expect(compiled).toContain("[[:space:]]+");
    expect(compiled).toContain("ILIKE");
    expect(values).toContain("anclaje_frente");
    expect(values).toContain("%TIPO INDIEL%");
  });

  it("escapa comodines ILIKE del valor buscado", () => {
    const sql = buildJsonTextContainsCondition("nota", "100% OFF");
    expect(sql.values).toContain("%100\\% OFF%");
  });

  it("devuelve un fragmento Prisma.Sql", () => {
    const sql = buildJsonTextContainsCondition("col", "abc");
    expect(Prisma.sql`${sql}`).toBeTruthy();
  });
});
