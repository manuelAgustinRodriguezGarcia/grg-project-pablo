import "server-only";
import {
  ARCA_NOTE_PRODUCTION_EMISSION_ENABLED_ENV,
  ARCA_PRODUCTION_EMISSION_ENABLED_ENV,
  isNoteProductionEmissionEnabledValue,
  isProductionEmissionEnabledValue,
} from "@/shared/fiscal/production-emission";

/** Lee el kill switch. No lo expone al browser. */
export function isArcaProductionEmissionEnabled(): boolean {
  return isProductionEmissionEnabledValue(
    process.env[ARCA_PRODUCTION_EMISSION_ENABLED_ENV],
  );
}

/** Lee el rollout de notas. No expone el valor crudo al browser. */
export function isArcaNoteProductionEmissionEnabled(): boolean {
  return isNoteProductionEmissionEnabledValue(
    process.env[ARCA_NOTE_PRODUCTION_EMISSION_ENABLED_ENV],
  );
}
