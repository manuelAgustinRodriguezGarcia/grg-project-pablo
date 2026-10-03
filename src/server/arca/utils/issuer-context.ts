import type {
  ArcaEnvironment,
  ArcaIssuerContext,
} from "@/server/arca/types/arca.types";
import { normalizeIssuerCuit } from "@/server/arca/utils/cuit";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";

export function toArcaIssuerContext(input: {
  environment: ArcaEnvironment;
  issuerCuit: string | null | undefined;
  pointOfSale: string;
}): ArcaIssuerContext {
  return {
    environment: input.environment,
    cuit: normalizeIssuerCuit(input.issuerCuit),
    pointOfSale: parseArcaPointOfSale(input.pointOfSale),
  };
}
