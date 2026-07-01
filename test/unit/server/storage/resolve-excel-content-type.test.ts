import { describe, expect, it } from "vitest";
import { resolveExcelContentType } from "@/server/storage/resolve-excel-content-type";

describe("resolveExcelContentType", () => {
  it("usa el MIME de .xlsx aunque el navegador reporte application/vnd.ms-excel", () => {
    expect(
      resolveExcelContentType(
        "lista.xlsx",
        "application/vnd.ms-excel",
      ),
    ).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("usa el MIME de .xlsm aunque el navegador reporte application/octet-stream", () => {
    expect(
      resolveExcelContentType("lista.xlsm", "application/octet-stream"),
    ).toBe("application/vnd.ms-excel.sheet.macroenabled.12");
  });

  it("conserva un MIME reportado válido para .xlsx", () => {
    expect(
      resolveExcelContentType(
        "lista.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("normaliza parámetros MIME con charset", () => {
    expect(
      resolveExcelContentType(
        "lista.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=binary",
      ),
    ).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });
});
