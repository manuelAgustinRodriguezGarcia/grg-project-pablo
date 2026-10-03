import "server-only";
import type { ArcaAccessEnvironment } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";
import type {
  ArcaTicketIdentity,
  ArcaTicketStore,
  PersistedArcaTicket,
} from "@/server/arca/tickets/ticket.types";

type TicketCacheDelegate = {
  findUnique(args: {
    where: {
      environment_service_certificateFingerprint: ArcaTicketIdentity;
    };
  }): Promise<PersistedArcaTicket | null>;
  upsert(args: {
    where: {
      environment_service_certificateFingerprint: ArcaTicketIdentity;
    };
    create: PersistedArcaTicket;
    update: Omit<PersistedArcaTicket, keyof ArcaTicketIdentity>;
  }): Promise<unknown>;
  deleteMany(args: { where: ArcaTicketIdentity }): Promise<unknown>;
};

type TicketDb = {
  arcaAccessTicketCache: TicketCacheDelegate;
};

function cacheOf(db?: unknown): TicketCacheDelegate {
  const client = (db ?? prisma) as TicketDb;
  return client.arcaAccessTicketCache;
}

function toEnvironment(
  environment: ArcaTicketIdentity["environment"],
): ArcaAccessEnvironment {
  return environment;
}

export class ArcaAccessTicketRepository implements ArcaTicketStore {
  async findTicket(
    identity: ArcaTicketIdentity,
    db?: unknown,
  ): Promise<PersistedArcaTicket | null> {
    const row = await cacheOf(db).findUnique({
      where: {
        environment_service_certificateFingerprint: {
          environment: toEnvironment(identity.environment),
          service: identity.service,
          certificateFingerprint: identity.certificateFingerprint,
        },
      },
    });

    return row;
  }

  async upsertTicket(ticket: PersistedArcaTicket, db?: unknown): Promise<void> {
    const identity = {
      environment: toEnvironment(ticket.environment),
      service: ticket.service,
      certificateFingerprint: ticket.certificateFingerprint,
    };

    await cacheOf(db).upsert({
      where: { environment_service_certificateFingerprint: identity },
      create: {
        ...identity,
        encryptedPayload: ticket.encryptedPayload,
        iv: ticket.iv,
        authTag: ticket.authTag,
        generationTime: ticket.generationTime,
        expirationTime: ticket.expirationTime,
        encryptionVersion: ticket.encryptionVersion,
      },
      update: {
        encryptedPayload: ticket.encryptedPayload,
        iv: ticket.iv,
        authTag: ticket.authTag,
        generationTime: ticket.generationTime,
        expirationTime: ticket.expirationTime,
        encryptionVersion: ticket.encryptionVersion,
      },
    });
  }

  async deleteTicket(identity: ArcaTicketIdentity, db?: unknown): Promise<void> {
    await cacheOf(db).deleteMany({
      where: {
        environment: toEnvironment(identity.environment),
        service: identity.service,
        certificateFingerprint: identity.certificateFingerprint,
      },
    });
  }
}

export const arcaAccessTicketRepository = new ArcaAccessTicketRepository();
