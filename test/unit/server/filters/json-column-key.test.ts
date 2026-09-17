import { describe, expect, it } from "vitest";
import { VALID_JSON_COLUMN_KEY } from "@/server/filters/json-column-key";

describe("VALID_JSON_COLUMN_KEY", () => {
  it("acepta claves con guiones usadas por columnas existentes", () => {
    expect(VALID_JSON_COLUMN_KEY.test("sub-rubro")).toBe(true);
    expect(VALID_JSON_COLUMN_KEY.test("voltaje_12v-24v")).toBe(true);
    expect(VALID_JSON_COLUMN_KEY.test("rosca_izq_-_der")).toBe(true);
  });

  it("acepta claves solo alfanuméricas y underscore", () => {
    expect(VALID_JSON_COLUMN_KEY.test("interior_mm")).toBe(true);
    expect(VALID_JSON_COLUMN_KEY.test("Serie6000")).toBe(true);
  });

  it("rechaza caracteres inseguros para la clave", () => {
    expect(VALID_JSON_COLUMN_KEY.test("sub rubro")).toBe(false);
    expect(VALID_JSON_COLUMN_KEY.test("sub'rubro")).toBe(false);
    expect(VALID_JSON_COLUMN_KEY.test('sub"rubro')).toBe(false);
    expect(VALID_JSON_COLUMN_KEY.test("sub;rubro")).toBe(false);
  });
});
