import { describe, expect, it } from "vitest";
import {
  buildDetectedHeaders,
  headerToInternalKey,
} from "@/server/importers/column-mapper";

describe("column-mapper slugify", () => {
  it("convierte guiones del header a underscore", () => {
    const used = new Set<string>();
    expect(headerToInternalKey("SUB-RUBRO", used)).toBe("sub_rubro");
  });

  it("colapsa guiones y espacios consecutivos en un solo underscore", () => {
    const used = new Set<string>();
    expect(headerToInternalKey("12V - 24V", used)).toBe("12v_24v");
    expect(headerToInternalKey("ROSCA IZQ - DER", used)).toBe("rosca_izq_der");
  });

  it("no cambia headers sin guiones", () => {
    const used = new Set<string>();
    expect(headerToInternalKey("NÚMERO", used)).toBe("numero");
    expect(headerToInternalKey("INTERIOR\n[mm]", used)).toBe("interior_mm");
  });

  it("genera internalKeys sin guiones en headers detectados", () => {
    const headers = buildDetectedHeaders([
      { originalName: "SUB-RUBRO", columnIndex: 0 },
      { originalName: "VOLTAJE 12V-24V", columnIndex: 1 },
    ]);

    expect(headers.map((header) => header.internalKey)).toEqual([
      "sub_rubro",
      "voltaje_12v_24v",
    ]);
  });
});
