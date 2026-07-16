/**
 * Picks a progress stall percentage from a pool so loading bars
 * don't freeze on the same values every run.
 */
export function pickProgressStall(candidates: readonly number[]): number {
  if (candidates.length === 0) {
    return 0;
  }

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index] ?? candidates[0] ?? 0;
}

export const UPLOAD_STALLS = [12, 14, 16, 18, 22] as const;
export const UPLOAD_WAIT_STALLS = [18, 22, 24, 28, 32] as const;
export const ANALYZE_STALLS = [36, 38, 42, 48, 52] as const;
export const SHEETS_STALLS = [54, 62, 68, 72, 78] as const;
export const ANALYSIS_FINISH_STALLS = [86, 88, 90, 92, 94] as const;

export const IMPORT_START_STALLS = [14, 16, 18, 22, 24] as const;
/** Early stall so long applies (replace) still have room to crawl toward ~91%. */
export const IMPORT_APPLY_STALLS = [28, 32, 36, 40, 44] as const;
export const IMPORT_REPORT_STALLS = [72, 76, 80, 84] as const;
export const IMPORT_FINISH_STALLS = [88, 90, 92, 94] as const;
