import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/database/prisma";
import { priceItemRepository } from "@/server/repositories/price-item.repository";
import { PRICE_ITEM_LIST_ORDER_BY } from "@/server/repositories/price-item-list-order";
import { buildSearchQueryPlan } from "@/server/search/search-query-plan";

vi.mock("@/server/database/prisma", () => ({
  prisma: {
    priceItem: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

function sqlText(parts: unknown[]): string {
  return parts
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (Array.isArray(part)) {
        return part.map((piece) => String(piece)).join(" ");
      }
      if (part && typeof part === "object") {
        const sqlPart = part as { sql?: string; strings?: string[]; values?: unknown[] };
        return [sqlPart.sql, ...(sqlPart.strings ?? []), sqlText(sqlPart.values ?? [])]
          .filter(Boolean)
          .join(" ");
      }
      return "";
    })
    .join(" ");
}

describe("PriceItemRepository order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.priceItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.priceItem.count).mockResolvedValue(0);
    vi.mocked(prisma.priceItem.create).mockResolvedValue({ id: "item-1" } as never);
    vi.mocked(prisma.priceItem.update).mockResolvedValue({ id: "item-1" } as never);
  });

  it("la página 2 del listado usa sourceRow y el offset de esa página", async () => {
    await priceItemRepository.findPaginated({ priceListId: "list-1" }, { page: 2, pageSize: 50 });

    expect(prisma.priceItem.findMany).toHaveBeenCalledWith({
      where: { priceListId: "list-1" },
      orderBy: PRICE_ITEM_LIST_ORDER_BY,
      skip: 50,
      take: 50,
    });
  });

  it("la búsqueda filtra por texto y mantiene el mismo orden en la página pedida", async () => {
    vi.mocked(prisma.$queryRaw).mockImplementation(((...parts: unknown[]) => {
      const text = sqlText(parts);
      if (text.includes("COUNT")) {
        return Promise.resolve([{ count: BigInt(3) }]);
      }
      return Promise.resolve([]);
    }) as never);

    const plan = buildSearchQueryPlan("filtro");
    const result = await priceItemRepository.findByPriceListPaginatedWithScopedSearch(
      "list-1",
      { page: 2, pageSize: 50 },
      plan!,
      { includePrimaryCode: true, includeDescription: true, dynamicKeys: [] },
    );

    const selectCall = vi.mocked(prisma.$queryRaw).mock.calls[0] ?? [];
    const text = sqlText(selectCall);
    expect(text).toContain("ILIKE");
    expect(text).toContain(`"sourceRow" ASC NULLS LAST, "createdAt" ASC, "id" ASC`);
    expect(text).not.toContain(`"updatedAt" DESC`);
    expect(selectCall).toContain(50);
    expect(result.page).toBe(2);
    expect(result.total).toBe(3);
  });

  it("countItemsBefore ubica el ítem con el mismo orden de la tabla", async () => {
    vi.mocked(prisma.priceItem.count).mockResolvedValue(4);
    const createdAt = new Date("2026-01-02T00:00:00.000Z");

    const before = await priceItemRepository.countItemsBefore("list-1", {
      id: "item-9",
      sourceRow: 10,
      createdAt,
    });

    expect(before).toBe(4);
    expect(prisma.priceItem.count).toHaveBeenCalledWith({
      where: {
        priceListId: "list-1",
        OR: [
          { sourceRow: { lt: 10 } },
          {
            AND: [
              { sourceRow: 10 },
              {
                OR: [
                  { createdAt: { lt: createdAt } },
                  { createdAt, id: { lt: "item-9" } },
                ],
              },
            ],
          },
        ],
      },
    });
  });

  it("un alta manual guarda sourceRow nulo y una edición no lo envía", async () => {
    await priceItemRepository.create({
      priceListId: "list-1",
      primaryCode: "MAN-1",
      description: "Manual",
      amount: null,
    });
    await priceItemRepository.update("item-1", {
      description: "Editado",
      amount: null,
    });

    expect(prisma.priceItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        primaryCode: "MAN-1",
        description: "Manual",
        sourceRow: null,
      }),
    });
    const updateData = vi.mocked(prisma.priceItem.update).mock.calls[0]?.[0].data;
    expect(updateData).toEqual({ description: "Editado", amount: null });
    expect(updateData).not.toHaveProperty("sourceRow");
  });

  it("la sincronización offline sigue paginando por id", async () => {
    await priceItemRepository.findByPriceListIdCursor("list-1", "cursor-1", 100);

    expect(prisma.priceItem.findMany).toHaveBeenCalledWith({
      where: { priceListId: "list-1" },
      orderBy: [{ id: "asc" }],
      take: 100,
      skip: 1,
      cursor: { id: "cursor-1" },
    });
  });
});
