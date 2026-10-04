import { describe, expect, it } from "vitest";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import { serializeCaeRequest } from "@/server/arca/wsfe/wsfe-cae-request";
import { buildFeCaeSolicitarXml } from "@/server/arca/wsfe/wsfe-soap";
import type { FeCaeRequestXml } from "@/server/arca/wsfe/wsfe-soap";
import type { ArcaCaeRequest } from "@/server/arca/wsfe/wsfe.types";

const INVOICE_XML = [
  '<FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/">',
  "<Auth></Auth>",
  "  <FeCAEReq>",
  "    <FeCabReq>",
  "      <CantReg>1</CantReg>",
  "      <PtoVta>7</PtoVta>",
  "      <CbteTipo>6</CbteTipo>",
  "    </FeCabReq>",
  "    <FeDetReq>",
  "      <FECAEDetRequest>",
  "        <Concepto>1</Concepto>",
  "        <DocTipo>99</DocTipo>",
  "        <DocNro>0</DocNro>",
  "        <CbteDesde>2</CbteDesde>",
  "        <CbteHasta>2</CbteHasta>",
  "        <CbteFch>20260930</CbteFch>",
  "        <ImpTotal>1210.00</ImpTotal>",
  "        <ImpTotConc>0.00</ImpTotConc>",
  "        <ImpNeto>1000.00</ImpNeto>",
  "        <ImpOpEx>0.00</ImpOpEx>",
  "        <ImpTrib>0.00</ImpTrib>",
  "        <ImpIVA>210.00</ImpIVA>",
  "        <MonId>PES</MonId>",
  "        <MonCotiz>1.00</MonCotiz>",
  "        <CondicionIVAReceptorId>5</CondicionIVAReceptorId>",
  "      <Iva>",
  "        <AlicIva>",
  "          <Id>5</Id>",
  "          <BaseImp>1000.00</BaseImp>",
  "          <Importe>210.00</Importe>",
  "        </AlicIva>",
  "      </Iva>",
  "      </FECAEDetRequest>",
  "    </FeDetReq>",
  "  </FeCAEReq>",
  "</FECAESolicitar>",
].join("\n");

function invoiceRequest(): FeCaeRequestXml {
  return {
    pointOfSale: 7,
    voucherType: 6,
    concept: 1,
    documentType: 99,
    documentNumber: 0,
    voucherFrom: 2,
    voucherTo: 2,
    voucherDate: "20260930",
    totalAmount: "1210.00",
    nonTaxedAmount: "0.00",
    netAmount: "1000.00",
    exemptAmount: "0.00",
    taxAmount: "0.00",
    vatAmount: "210.00",
    currencyId: "PES",
    currencyRate: "1.00",
    receiverVatConditionId: 5,
    vatLines: [{ id: 5, baseAmount: "1000.00", amount: "210.00" }],
  };
}

function caeRequest(): ArcaCaeRequest {
  return {
    environment: "HOMOLOGACION",
    accessTicket: {
      token: "token",
      sign: "sign",
      generationTime: new Date("2026-09-30T12:00:00.000Z"),
      expirationTime: new Date("2026-09-30T18:00:00.000Z"),
      service: "wsfe",
      environment: "HOMOLOGACION",
    },
    issuerCuit: "30712345671",
    pointOfSale: 7,
    voucherType: 6,
    concept: 1,
    documentType: 99,
    documentNumber: 0,
    voucherFrom: 2,
    voucherTo: 2,
    voucherDate: "20260930",
    totalAmount: 1210,
    nonTaxedAmount: 0,
    netAmount: 1000,
    exemptAmount: 0,
    taxAmount: 0,
    vatAmount: 210,
    currencyId: "PES",
    currencyRate: 1,
    receiverVatConditionId: 5,
    vatBreakdown: [{ id: 5, baseAmount: 1000, amount: 210 }],
  };
}

function xmlOf(request: FeCaeRequestXml): string {
  return buildFeCaeSolicitarXml({
    authXml: "<Auth></Auth>",
    request,
  });
}

describe("CbtesAsoc en FECAESolicitar", () => {
  it("deja el XML de una factura sin comprobantes asociados", () => {
    const withoutField = xmlOf(invoiceRequest());
    const emptyList = xmlOf({ ...invoiceRequest(), associatedVouchers: [] });

    expect(withoutField).toBe(INVOICE_XML);
    expect(emptyList).toBe(INVOICE_XML);
    expect(withoutField).not.toContain("CbtesAsoc");
    expect(serializeCaeRequest(caeRequest())).not.toHaveProperty("associatedVouchers");
  });

  it("serializa una nota de crédito con la factura original", () => {
    const xml = xmlOf({
      ...invoiceRequest(),
      voucherType: 3,
      associatedVouchers: [
        {
          type: 1,
          pointOfSale: 7,
          number: 15,
          issuerCuit: "30712345671",
          issuedAt: "20260930",
        },
      ],
    });

    expect(xml).toContain("<CbteTipo>3</CbteTipo>");
    expect(xml).toContain(
      [
        "        <CbtesAsoc>",
        "          <CbteAsoc>",
        "            <Tipo>1</Tipo>",
        "            <PtoVta>7</PtoVta>",
        "            <Nro>15</Nro>",
        "            <Cuit>30712345671</Cuit>",
        "            <CbteFch>20260930</CbteFch>",
        "          </CbteAsoc>",
        "        </CbtesAsoc>",
      ].join("\n"),
    );
  });

  it("serializa una nota de débito B asociada a una factura B", () => {
    const xml = xmlOf({
      ...invoiceRequest(),
      voucherType: 7,
      associatedVouchers: [
        {
          type: 6,
          pointOfSale: 7,
          number: 3,
        },
      ],
    });

    expect(xml).toContain("<CbteTipo>7</CbteTipo>");
    expect(xml).toContain("<Tipo>6</Tipo>");
    expect(xml).toContain("<PtoVta>7</PtoVta>");
    expect(xml).toContain("<Nro>3</Nro>");
    expect(xml).not.toContain("<Cuit>");
    expect(xml).not.toContain("<CbtesAsoc>\n          <CbteAsoc>\n            <Tipo>6</Tipo>\n            <PtoVta>7</PtoVta>\n            <Nro>3</Nro>\n            <CbteFch>");
  });

  it("escapa el CUIT asociado y conserva el escape de MonId", () => {
    const xml = xmlOf({
      ...invoiceRequest(),
      currencyId: "A&B",
      associatedVouchers: [
        {
          type: 1,
          pointOfSale: 7,
          number: 1,
          issuerCuit: "30&1234567",
          issuedAt: "20260930",
        },
      ],
    });

    expect(xml).toContain("<MonId>A&amp;B</MonId>");
    expect(xml).toContain("<Cuit>30&amp;1234567</Cuit>");
    expect(xml).not.toContain("<Cuit>30&1234567</Cuit>");
  });

  it("rechaza un comprobante asociado con fecha inválida", () => {
    expect(() =>
      serializeCaeRequest({
        ...caeRequest(),
        voucherType: 3,
        associatedVouchers: [
          {
            type: 1,
            pointOfSale: 7,
            number: 1,
            issuedAt: "2026-09-30",
          },
        ],
      }),
    ).toThrow(ArcaWsfeError);
  });
});
