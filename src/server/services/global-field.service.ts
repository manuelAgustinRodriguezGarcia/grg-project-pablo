import { globalFieldRepository } from "@/server/repositories/global-field.repository";
import { ColumnConfigError } from "./column-config.errors";

export class GlobalFieldService {
  async listGlobalFields() {
    return globalFieldRepository.findAll();
  }

  async assertValidGlobalFieldKey(globalFieldKey: string | null | undefined): Promise<void> {
    if (!globalFieldKey) {
      return;
    }

    const exists = await globalFieldRepository.existsByKey(globalFieldKey);
    if (!exists) {
      throw new ColumnConfigError(
        `El campo global "${globalFieldKey}" no existe.`,
        "VALIDATION_ERROR",
      );
    }
  }
}

export const globalFieldService = new GlobalFieldService();
