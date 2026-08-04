/** Pure numeric text for range bounds (optional leading -, `.` or `,` decimals). */
export function parsePureNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^-?\d+([.,]\d+)?$/.test(trimmed)) {
    return null;
  }

  const normalized = trimmed.replace(",", ".");
  const numeric = Number(normalized);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
}

export function isPureNumericFilterValue(value: string): boolean {
  return parsePureNumber(value) !== null;
}

export function parseBetweenFilterValue(
  value: string,
): { min: number; max: number } | null {
  const parts = value.split("|");
  if (parts.length !== 2) {
    return null;
  }

  const left = parsePureNumber(parts[0] ?? "");
  const right = parsePureNumber(parts[1] ?? "");

  if (left === null || right === null) {
    return null;
  }

  return {
    min: Math.min(left, right),
    max: Math.max(left, right),
  };
}

export function buildBetweenFilterValue(
  fromRaw: string,
  toRaw: string,
): string | null {
  const from = parsePureNumber(fromRaw);
  const to = parsePureNumber(toRaw);

  if (from === null || to === null) {
    return null;
  }

  const min = Math.min(from, to);
  const max = Math.max(from, to);

  return `${String(min)}|${String(max)}`;
}

export function splitBetweenFilterValue(
  value: string,
): { from: string; to: string } | null {
  const parsed = parseBetweenFilterValue(value);

  if (!parsed) {
    return null;
  }

  return {
    from: String(parsed.min),
    to: String(parsed.max),
  };
}

export function formatBetweenFilterLabel(
  displayName: string,
  value: string,
): string | null {
  const parsed = parseBetweenFilterValue(value);

  if (!parsed) {
    return null;
  }

  return `${displayName}: ${String(parsed.min)} - ${String(parsed.max)}`;
}
