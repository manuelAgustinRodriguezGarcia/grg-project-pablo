import { describe, expect, it, vi } from "vitest";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { resolveArcaEndpoints } from "@/server/arca/config/endpoints";
import {
  buildLoginTicketRequest,
  buildUniqueId,
  formatXsdDateTimeUtc,
} from "@/server/arca/wsaa/build-tra";
import { requestWsaaTicket } from "@/server/arca/wsaa/wsaa-client";

const NOW = new Date("2026-09-29T04:00:00.000Z");
const TEN_MINUTES_MS = 10 * 60 * 1000;

describe("buildLoginTicketRequest", () => {
  it("arma un XML de TRA con el servicio recibido", () => {
    const service = resolveArcaEndpoints("HOMOLOGACION").service;
    const tra = buildLoginTicketRequest({ service, now: NOW });

    expect(service).toBe("wsfe");
    expect(tra.xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(tra.xml).toContain('<loginTicketRequest version="1.0">');
    expect(tra.xml).toContain(`<service>${service}</service>`);
    expect(tra.xml).not.toContain("<source>");
    expect(tra.xml).not.toContain("<destination>");
  });

  it("no hardcodea el servicio dentro del XML", () => {
    const tra = buildLoginTicketRequest({
      service: "wsfe-test",
      now: NOW,
    });

    expect(tra.xml).toContain("<service>wsfe-test</service>");
    expect(tra.xml).not.toContain("<service>wsfe</service>");
  });

  it("genera un uniqueId unsigned de 32 bits", () => {
    const ids = Array.from({ length: 8 }, () => buildUniqueId());

    for (const uniqueId of ids) {
      expect(Number.isInteger(uniqueId)).toBe(true);
      expect(uniqueId).toBeGreaterThan(0);
      expect(uniqueId).toBeLessThanOrEqual(4_294_967_295);
    }

    expect(new Set(ids).size).toBeGreaterThan(1);
  });

  it("acepta un uniqueId inyectado y un generador determinista", () => {
    const injected = buildLoginTicketRequest({
      service: "wsfe",
      now: NOW,
      uniqueId: 4_294_967_295,
    });
    const generated = buildLoginTicketRequest({
      service: "wsfe",
      now: NOW,
      createUniqueId: () => 42,
    });

    expect(injected.uniqueId).toBe(4_294_967_295);
    expect(injected.xml).toContain("<uniqueId>4294967295</uniqueId>");
    expect(generated.uniqueId).toBe(42);
    expect(generated.xml).toContain("<uniqueId>42</uniqueId>");
  });

  it("rechaza un uniqueId fuera del rango", () => {
    expect(() =>
      buildLoginTicketRequest({ service: "wsfe", now: NOW, uniqueId: 0 }),
    ).toThrowError(expect.objectContaining({ code: "TRA_INVALID" }));
    expect(() =>
      buildLoginTicketRequest({
        service: "wsfe",
        now: NOW,
        uniqueId: 4_294_967_296,
      }),
    ).toThrowError(expect.objectContaining({ code: "TRA_INVALID" }));
  });

  it("usa generationTime ahora menos 10 minutos y expirationTime ahora más 10", () => {
    const tra = buildLoginTicketRequest({ service: "wsfe", now: NOW });

    expect(tra.generationTime.toISOString()).toBe(
      new Date(NOW.getTime() - TEN_MINUTES_MS).toISOString(),
    );
    expect(tra.expirationTime.toISOString()).toBe(
      new Date(NOW.getTime() + TEN_MINUTES_MS).toISOString(),
    );
    expect(tra.xml).toContain(
      `<generationTime>${formatXsdDateTimeUtc(tra.generationTime)}</generationTime>`,
    );
    expect(tra.xml).toContain(
      `<expirationTime>${formatXsdDateTimeUtc(tra.expirationTime)}</expirationTime>`,
    );
  });

  it("repite el mismo XML si el reloj y el uniqueId están fijos", () => {
    const first = buildLoginTicketRequest({
      service: "wsfe",
      now: NOW,
      uniqueId: 1_790_654_400,
    });
    const second = buildLoginTicketRequest({
      service: "wsfe",
      now: NOW,
      uniqueId: 1_790_654_400,
    });

    expect(second).toEqual(first);
    expect(first.xml).toContain("<uniqueId>1790654400</uniqueId>");
    expect(first.xml).toContain("<generationTime>2026-09-29T03:50:00Z</generationTime>");
    expect(first.xml).toContain("<expirationTime>2026-09-29T04:10:00Z</expirationTime>");
  });
});

describe("requestWsaaTicket en modo prueba", () => {
  it("rechaza MODO_PRUEBA sin llamar a la red", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(requestWsaaTicket("MODO_PRUEBA")).rejects.toBeInstanceOf(
      ArcaConfigurationError,
    );
    await expect(requestWsaaTicket("MODO_PRUEBA")).rejects.toMatchObject({
      code: "AMBIENTE_NO_SOPORTADO",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
