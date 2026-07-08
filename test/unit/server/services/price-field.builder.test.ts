import { describe, expect, it } from "vitest";
import { buildIndexedTextForMappedPriceItem } from "@/server/services/price-field.builder";

describe("buildIndexedTextForMappedPriceItem", () => {
  it("incluye todas las columnas dinámicas aunque no sean buscables", () => {
    const indexedText = buildIndexedTextForMappedPriceItem(
      [
        {
          internalKey: "codigo",
          isPrimaryCode: true,
          isDescription: false,
          isPrice: false,
          isSearchable: true,
        } as never,
        {
          internalKey: "montadora",
          isPrimaryCode: false,
          isDescription: false,
          isPrice: false,
          isSearchable: false,
        } as never,
      ],
      {
        primaryCode: "123",
        description: "Repuesto",
        amount: "10",
        dynamicData: {
          montadora: "FIAT",
        },
      },
    );

    expect(indexedText).toContain("123");
    expect(indexedText).toContain("Repuesto");
    expect(indexedText).toContain("FIAT");
  });
});
