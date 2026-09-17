import { describe, expect, it } from "vitest";
import {
  formatCuit,
  formatDni,
  isValidCuit,
  isValidDni,
  normalizeIdentificationDigits,
} from "@/shared/utils/identification";

const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

function computeVerifier(prefix: string): number {
  const sum = prefix
    .split("")
    .reduce(
      (accumulated, digit, index) =>
        accumulated + Number(digit) * CUIT_WEIGHTS[index],
      0,
    );
  return 11 - (sum % 11);
}

describe("normalizeIdentificationDigits", () => {
  it("elimina guiones, puntos y espacios", () => {
    expect(normalizeIdentificationDigits("30-50001091-2")).toBe("30500010912");
    expect(normalizeIdentificationDigits("20.329.642.330")).toBe("20329642330");
    expect(normalizeIdentificationDigits(" 12 345 678 ")).toBe("12345678");
  });
});

describe("isValidCuit", () => {
  it("acepta CUITs válidos conocidos", () => {
    expect(isValidCuit("30500010912")).toBe(true);
    expect(isValidCuit("20000000001")).toBe(true);
  });

  it("acepta CUITs con guiones porque normaliza antes de validar", () => {
    expect(isValidCuit("30-50001091-2")).toBe(true);
  });

  it("rechaza un dígito verificador incorrecto", () => {
    expect(isValidCuit("30500010913")).toBe(false);
    expect(isValidCuit("30500010911")).toBe(false);
  });

  it("rechaza longitudes distintas de 11 dígitos", () => {
    expect(isValidCuit("3050001091")).toBe(false);
    expect(isValidCuit("305000109123")).toBe(false);
    expect(isValidCuit("")).toBe(false);
  });

  it("rechaza todos los candidatos cuando el cálculo da 10", () => {
    let prefixWithRemainderTen: string | null = null;

    for (let candidate = 0; candidate < 10_000_000_000; candidate += 1234567) {
      const prefix = String(candidate).padStart(10, "0");
      if (computeVerifier(prefix) === 10) {
        prefixWithRemainderTen = prefix;
        break;
      }
    }

    expect(prefixWithRemainderTen).not.toBeNull();

    for (let digit = 0; digit <= 9; digit += 1) {
      expect(isValidCuit(`${prefixWithRemainderTen}${digit}`)).toBe(false);
    }
  });

  it("normaliza el resultado 11 a dígito verificador 0", () => {
    let prefixWithRemainderEleven: string | null = null;

    for (let candidate = 0; candidate < 10_000_000_000; candidate += 1234567) {
      const prefix = String(candidate).padStart(10, "0");
      if (computeVerifier(prefix) === 11) {
        prefixWithRemainderEleven = prefix;
        break;
      }
    }

    expect(prefixWithRemainderEleven).not.toBeNull();
    expect(isValidCuit(`${prefixWithRemainderEleven}0`)).toBe(true);
    expect(isValidCuit(`${prefixWithRemainderEleven}5`)).toBe(false);
  });
});

describe("formatCuit", () => {
  it("aplica el formato XX-XXXXXXXX-X", () => {
    expect(formatCuit("30500010912")).toBe("30-50001091-2");
  });

  it("devuelve el valor original si no tiene 11 dígitos", () => {
    expect(formatCuit("1234")).toBe("1234");
  });
});

describe("isValidDni", () => {
  it("acepta 7 y 8 dígitos", () => {
    expect(isValidDni("1234567")).toBe(true);
    expect(isValidDni("12345678")).toBe(true);
  });

  it("rechaza longitudes fuera de rango", () => {
    expect(isValidDni("123456")).toBe(false);
    expect(isValidDni("123456789")).toBe(false);
    expect(isValidDni("")).toBe(false);
  });
});

describe("formatDni", () => {
  it("agrega separador de miles", () => {
    expect(formatDni("12345678")).toBe("12.345.678");
  });

  it("devuelve el valor original si no es un DNI válido", () => {
    expect(formatDni("12")).toBe("12");
  });
});
