import "server-only";
import {
  ARCA_PRODUCTION_EMISSION_ENABLED_ENV,
  isProductionEmissionEnabledValue,
} from "@/shared/fiscal/production-emission";

/** Lee el kill switch. No lo expone al browser. */
export function isArcaProductionEmissionEnabled(): boolean {
  return isProductionEmissionEnabledValue(
    process.env[ARCA_PRODUCTION_EMISSION_ENABLED_ENV],
  );
}
