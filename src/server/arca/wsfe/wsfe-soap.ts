import "server-only";

export const WSFE_NAMESPACE = "http://ar.gov.afip.dif.FEV1/";

export const FE_DUMMY = "FEDummy";
export const FE_COMP_TOT_X_REQUEST = "FECompTotXRequest";
export const FE_COMP_ULTIMO_AUTORIZADO = "FECompUltimoAutorizado";
export const FE_CAE_SOLICITAR = "FECAESolicitar";
export const FE_COMP_CONSULTAR = "FECompConsultar";

export const FE_DUMMY_ACTION = `${WSFE_NAMESPACE}${FE_DUMMY}`;
export const FE_COMP_TOT_X_REQUEST_ACTION = `${WSFE_NAMESPACE}${FE_COMP_TOT_X_REQUEST}`;
export const FE_COMP_ULTIMO_AUTORIZADO_ACTION = `${WSFE_NAMESPACE}${FE_COMP_ULTIMO_AUTORIZADO}`;
export const FE_CAE_SOLICITAR_ACTION = `${WSFE_NAMESPACE}${FE_CAE_SOLICITAR}`;
export const FE_COMP_CONSULTAR_ACTION = `${WSFE_NAMESPACE}${FE_COMP_CONSULTAR}`;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildWsfeAuthXml(input: {
  token: string;
  sign: string;
  cuit: string;
}): string {
  return [
    "  <Auth>",
    `    <Token>${escapeXml(input.token)}</Token>`,
    `    <Sign>${escapeXml(input.sign)}</Sign>`,
    `    <Cuit>${escapeXml(input.cuit)}</Cuit>`,
    "  </Auth>",
  ].join("\n");
}

export function buildWsfeEnvelope(operationXml: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">',
    "  <soapenv:Header/>",
    "  <soapenv:Body>",
    operationXml,
    "  </soapenv:Body>",
    "</soapenv:Envelope>",
  ].join("\n");
}

export function buildFeDummyXml(): string {
  return `<${FE_DUMMY} xmlns="${WSFE_NAMESPACE}"/>`;
}

export function buildFeCompTotXRequestXml(authXml: string): string {
  return [
    `<${FE_COMP_TOT_X_REQUEST} xmlns="${WSFE_NAMESPACE}">`,
    authXml,
    `</${FE_COMP_TOT_X_REQUEST}>`,
  ].join("\n");
}

export function buildFeCompUltimoAutorizadoXml(input: {
  authXml: string;
  pointOfSale: number;
  voucherType: number;
}): string {
  return [
    `<${FE_COMP_ULTIMO_AUTORIZADO} xmlns="${WSFE_NAMESPACE}">`,
    input.authXml,
    `  <PtoVta>${input.pointOfSale}</PtoVta>`,
    `  <CbteTipo>${input.voucherType}</CbteTipo>`,
    `</${FE_COMP_ULTIMO_AUTORIZADO}>`,
  ].join("\n");
}

export type FeCaeVatLineXml = {
  id: number;
  baseAmount: string;
  amount: string;
};

export type FeCaeAssociatedVoucherXml = {
  type: number;
  pointOfSale: number;
  number: number;
  issuerCuit?: string;
  issuedAt?: string;
};

export type FeCaeRequestXml = {
  pointOfSale: number;
  voucherType: number;
  concept: number;
  documentType: number;
  documentNumber: number;
  voucherFrom: number;
  voucherTo: number;
  voucherDate: string;
  totalAmount: string;
  nonTaxedAmount: string;
  netAmount: string;
  exemptAmount: string;
  taxAmount: string;
  vatAmount: string;
  currencyId: string;
  currencyRate: string;
  receiverVatConditionId: number;
  vatLines: FeCaeVatLineXml[];
  associatedVouchers?: FeCaeAssociatedVoucherXml[];
};

function buildAssociatedVouchersXml(
  vouchers: FeCaeAssociatedVoucherXml[] | undefined,
): string[] {
  if (!vouchers || vouchers.length === 0) {
    return [];
  }

  return [
    "        <CbtesAsoc>",
    ...vouchers.flatMap((voucher) => [
      "          <CbteAsoc>",
      `            <Tipo>${voucher.type}</Tipo>`,
      `            <PtoVta>${voucher.pointOfSale}</PtoVta>`,
      `            <Nro>${voucher.number}</Nro>`,
      ...(voucher.issuerCuit
        ? [`            <Cuit>${escapeXml(voucher.issuerCuit)}</Cuit>`]
        : []),
      ...(voucher.issuedAt
        ? [`            <CbteFch>${escapeXml(voucher.issuedAt)}</CbteFch>`]
        : []),
      "          </CbteAsoc>",
    ]),
    "        </CbtesAsoc>",
  ];
}

function buildVatXml(lines: FeCaeVatLineXml[]): string[] {
  if (lines.length === 0) {
    return [];
  }

  return [
    "      <Iva>",
    ...lines.flatMap((line) => [
      "        <AlicIva>",
      `          <Id>${line.id}</Id>`,
      `          <BaseImp>${line.baseAmount}</BaseImp>`,
      `          <Importe>${line.amount}</Importe>`,
      "        </AlicIva>",
    ]),
    "      </Iva>",
  ];
}

export function buildFeCaeSolicitarXml(input: {
  authXml: string;
  request: FeCaeRequestXml;
}): string {
  const request = input.request;

  return [
    `<${FE_CAE_SOLICITAR} xmlns="${WSFE_NAMESPACE}">`,
    input.authXml,
    "  <FeCAEReq>",
    "    <FeCabReq>",
    "      <CantReg>1</CantReg>",
    `      <PtoVta>${request.pointOfSale}</PtoVta>`,
    `      <CbteTipo>${request.voucherType}</CbteTipo>`,
    "    </FeCabReq>",
    "    <FeDetReq>",
    "      <FECAEDetRequest>",
    `        <Concepto>${request.concept}</Concepto>`,
    `        <DocTipo>${request.documentType}</DocTipo>`,
    `        <DocNro>${request.documentNumber}</DocNro>`,
    `        <CbteDesde>${request.voucherFrom}</CbteDesde>`,
    `        <CbteHasta>${request.voucherTo}</CbteHasta>`,
    `        <CbteFch>${request.voucherDate}</CbteFch>`,
    `        <ImpTotal>${request.totalAmount}</ImpTotal>`,
    `        <ImpTotConc>${request.nonTaxedAmount}</ImpTotConc>`,
    `        <ImpNeto>${request.netAmount}</ImpNeto>`,
    `        <ImpOpEx>${request.exemptAmount}</ImpOpEx>`,
    `        <ImpTrib>${request.taxAmount}</ImpTrib>`,
    `        <ImpIVA>${request.vatAmount}</ImpIVA>`,
    `        <MonId>${escapeXml(request.currencyId)}</MonId>`,
    `        <MonCotiz>${request.currencyRate}</MonCotiz>`,
    `        <CondicionIVAReceptorId>${request.receiverVatConditionId}</CondicionIVAReceptorId>`,
    ...buildAssociatedVouchersXml(request.associatedVouchers),
    ...buildVatXml(request.vatLines),
    "      </FECAEDetRequest>",
    "    </FeDetReq>",
    "  </FeCAEReq>",
    `</${FE_CAE_SOLICITAR}>`,
  ].join("\n");
}

export function buildFeCompConsultarXml(input: {
  authXml: string;
  pointOfSale: number;
  voucherType: number;
  voucherNumber: number;
}): string {
  return [
    `<${FE_COMP_CONSULTAR} xmlns="${WSFE_NAMESPACE}">`,
    input.authXml,
    "  <FeCompConsReq>",
    `    <CbteTipo>${input.voucherType}</CbteTipo>`,
    `    <CbteNro>${input.voucherNumber}</CbteNro>`,
    `    <PtoVta>${input.pointOfSale}</PtoVta>`,
    "  </FeCompConsReq>",
    `</${FE_COMP_CONSULTAR}>`,
  ].join("\n");
}
