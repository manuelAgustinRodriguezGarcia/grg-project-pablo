import { describe, expect, it } from "vitest";
import { findRepeatedColumnNames } from "@/server/importers/repeated-column.detector";
import type { DetectedHeader, ImportJobConfig } from "@/server/importers/types";

const HEADERS: DetectedHeader[] = [
  {
    originalName: "DETALLE",
    internalKey: "detalle",
    columnIndex: 0,
    inferredDataType: "TEXT",
  },
  {
    originalName: "PRECIO",
    internalKey: "precio",
    columnIndex: 1,
    inferredDataType: "TEXT",
  },
  {
    originalName: "NUEVA",
    internalKey: "nueva",
    columnIndex: 2,
    inferredDataType: "TEXT",
  },
];

describe("findRepeatedColumnNames", () => {
  it("devuelve columnas del Excel que ya existen en la carpeta", () => {
    const config: ImportJobConfig = {
      columnMapping: [
        { headerInternalKey: "detalle", folderColumnInternalKey: "detalle" },
        { headerInternalKey: "precio", folderColumnInternalKey: "precio" },
        { headerInternalKey: "nueva", folderColumnInternalKey: "nueva" },
      ],
    };

    const repeated = findRepeatedColumnNames(
      HEADERS,
      [
        { originalName: "DETALLE", internalKey: "detalle" },
        { originalName: "MARCA", internalKey: "marca" },
      ],
      config,
    );

    expect(repeated).toEqual(["DETALLE"]);
  });

  it("no devuelve columnas cuando la carpeta está vacía", () => {
    const repeated = findRepeatedColumnNames(HEADERS, [], {
      columnMapping: [
        { headerInternalKey: "detalle", folderColumnInternalKey: "detalle" },
      ],
    });

    expect(repeated).toEqual([]);
  });

  it("ignora columnas marcadas para no importar", () => {
    const repeated = findRepeatedColumnNames(
      HEADERS,
      [{ originalName: "DETALLE", internalKey: "detalle" }],
      {
        columnMapping: [
          { headerInternalKey: "detalle", folderColumnInternalKey: "__ignore__" },
        ],
      },
    );

    expect(repeated).toEqual([]);
  });
});
