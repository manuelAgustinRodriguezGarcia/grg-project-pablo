import { describe, expect, it } from "vitest";
import { pageForProductIndex } from "./product-page";

describe("pageForProductIndex", () => {
  it("calcula la página 1-based del índice", () => {
    expect(pageForProductIndex(0, 100)).toBe(1);
    expect(pageForProductIndex(99, 100)).toBe(1);
    expect(pageForProductIndex(100, 100)).toBe(2);
    expect(pageForProductIndex(250, 100)).toBe(3);
  });

  it("devuelve null si el índice o el pageSize son inválidos", () => {
    expect(pageForProductIndex(-1, 100)).toBeNull();
    expect(pageForProductIndex(0, 0)).toBeNull();
  });
});
