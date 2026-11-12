/**
 * Importes de estadísticas en centavos enteros.
 * No suma dinero con floats de JavaScript.
 * Los literales bigint no están disponibles con el target ES2017 del proyecto.
 */

const DECIMAL_2 = /^(-?)(\d+)\.(\d{2})$/;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const HUNDRED = BigInt(100);
const TEN_THOUSAND = BigInt(10000);
const NEGATIVE_ONE = BigInt(-1);

export type MoneyParts = {
  netCents: bigint;
  vatCents: bigint;
  totalCents: bigint;
};

export const ZERO_MONEY: MoneyParts = {
  netCents: ZERO,
  vatCents: ZERO,
  totalCents: ZERO,
};

export function parseMinorUnits(value: string): bigint {
  const match = DECIMAL_2.exec(value);
  if (!match) {
    throw new Error("El importe decimal no tiene dos decimales.");
  }

  const sign = match[1] === "-" ? NEGATIVE_ONE : ONE;
  const whole = match[2] ?? "0";
  const fraction = match[3] ?? "00";
  return sign * (BigInt(whole) * HUNDRED + BigInt(fraction));
}

export function formatMinorUnits(value: bigint): string {
  const negative = value < ZERO;
  const absolute = negative ? -value : value;
  const whole = absolute / HUNDRED;
  const fraction = (absolute % HUNDRED).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

export function createMoney(): MoneyParts {
  return { netCents: ZERO, vatCents: ZERO, totalCents: ZERO };
}

export function addMoney(target: MoneyParts, amount: MoneyParts): void {
  target.netCents += amount.netCents;
  target.vatCents += amount.vatCents;
  target.totalCents += amount.totalCents;
}

export function sumMoney(amounts: readonly MoneyParts[]): MoneyParts {
  const total = createMoney();
  for (const amount of amounts) {
    addMoney(total, amount);
  }
  return total;
}

export function subtractMoney(current: MoneyParts, baseline: MoneyParts): MoneyParts {
  return {
    netCents: current.netCents - baseline.netCents,
    vatCents: current.vatCents - baseline.vatCents,
    totalCents: current.totalCents - baseline.totalCents,
  };
}

export function roundingGapCents(money: MoneyParts): bigint {
  return money.totalCents - money.netCents - money.vatCents;
}

export function moneyFromInvoice(input: {
  total: string;
  ivaAmount: string;
  totalVisualRounded: string;
}): MoneyParts {
  const fiscalTotal = parseMinorUnits(input.total);
  const vatCents = parseMinorUnits(input.ivaAmount);
  return {
    netCents: fiscalTotal - vatCents,
    vatCents,
    totalCents: parseMinorUnits(input.totalVisualRounded),
  };
}

export function moneyFromNote(input: {
  kind: "CREDIT" | "DEBIT";
  netAmount: string;
  ivaAmount: string;
  amount: string;
}): MoneyParts {
  const sign = noteSign(input.kind);
  return {
    netCents: sign * parseMinorUnits(input.netAmount),
    vatCents: sign * parseMinorUnits(input.ivaAmount),
    totalCents: sign * parseMinorUnits(input.amount),
  };
}

export function noteSign(kind: "CREDIT" | "DEBIT"): bigint {
  switch (kind) {
    case "CREDIT":
      return NEGATIVE_ONE;
    case "DEBIT":
      return ONE;
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}

/**
 * Reparte `total` entre pesos no negativos.
 * Los residuos de la división entera se asignan por mayores restos.
 * Si dos restos empatan, el centavo queda en el índice menor.
 * Si todos los pesos son cero, reparte en partes iguales: los pesos
 * originales no distinguen líneas.
 */
export function distributeByWeights(total: bigint, weights: readonly bigint[]): bigint[] {
  if (weights.length === 0) {
    throw new Error("No hay líneas para distribuir.");
  }

  if (weights.some((weight) => weight < ZERO)) {
    throw new Error("Un peso negativo no se puede distribuir.");
  }

  const weightSum = weights.reduce((sum, weight) => sum + weight, ZERO);
  const effectiveWeights = weightSum === ZERO ? weights.map(() => ONE) : weights;
  const denominator = weightSum === ZERO ? BigInt(weights.length) : weightSum;
  const negativeTotal = total < ZERO;
  const absoluteTotal = negativeTotal ? -total : total;
  const shares = effectiveWeights.map(() => ZERO);
  const remainders: Array<{ index: number; remainder: bigint }> = [];
  let allocated = ZERO;

  for (let index = 0; index < effectiveWeights.length; index += 1) {
    const weight = effectiveWeights[index] ?? ZERO;
    const numerator = absoluteTotal * weight;
    const base = numerator / denominator;
    shares[index] = base;
    allocated += base;
    remainders.push({ index, remainder: numerator % denominator });
  }

  let leftover = absoluteTotal - allocated;
  remainders.sort((left, right) => {
    if (left.remainder === right.remainder) {
      return left.index - right.index;
    }
    return left.remainder > right.remainder ? -1 : 1;
  });

  let cursor = 0;
  while (leftover > ZERO) {
    const target = remainders[cursor % remainders.length];
    if (!target) {
      break;
    }
    shares[target.index] = (shares[target.index] ?? ZERO) + ONE;
    leftover -= ONE;
    cursor += 1;
  }

  const signed = negativeTotal ? shares.map((share) => -share) : shares;
  const signedSum = signed.reduce((sum, share) => sum + share, ZERO);
  if (signedSum !== total) {
    throw new Error("La distribución de centavos no cierra.");
  }

  return signed;
}

export type ShareView = {
  percent: string | null;
  unavailableReason: "ZERO_TOTAL" | "NEGATIVE_TOTAL" | null;
};

/**
 * Porcentaje con dos decimales, redondeo half-up.
 * Si el total del período es cero o negativo, no hay porcentaje:
 * un denominador así no representa una participación.
 * Los porcentajes de filas distintas se redondean por separado y
 * pueden no sumar 100.00. El importe exacto viaja en los centavos.
 */
export function shareOf(part: bigint, whole: bigint): ShareView {
  if (whole === ZERO) {
    return { percent: null, unavailableReason: "ZERO_TOTAL" };
  }

  if (whole < ZERO) {
    return { percent: null, unavailableReason: "NEGATIVE_TOTAL" };
  }

  const negative = part < ZERO;
  const absolutePart = negative ? -part : part;
  const scaled = absolutePart * TEN_THOUSAND;
  const quotient = scaled / whole;
  const remainder = scaled % whole;
  const rounded = remainder * TWO >= whole ? quotient + ONE : quotient;
  const percentWhole = rounded / HUNDRED;
  const percentFraction = rounded % HUNDRED;
  const fraction = percentFraction.toString().padStart(2, "0");
  const percent = `${negative ? "-" : ""}${percentWhole.toString()}.${fraction}`;

  return { percent, unavailableReason: null };
}

export function presentMoney(money: MoneyParts): {
  net: string;
  vat: string;
  total: string;
  roundingGap: string;
} {
  return {
    net: formatMinorUnits(money.netCents),
    vat: formatMinorUnits(money.vatCents),
    total: formatMinorUnits(money.totalCents),
    roundingGap: formatMinorUnits(roundingGapCents(money)),
  };
}
