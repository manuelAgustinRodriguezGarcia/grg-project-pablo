import "server-only";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";

export type ArcaTicketIdentity = {
  environment: ArcaEnvironment;
  service: string;
  certificateFingerprint: string;
};

/** Fila ya cifrada. El repository no ve token ni sign. */
export type PersistedArcaTicket = ArcaTicketIdentity & {
  encryptedPayload: string;
  iv: string;
  authTag: string;
  generationTime: Date;
  expirationTime: Date;
  encryptionVersion: number;
};

export type ArcaTicketStore = {
  findTicket(
    identity: ArcaTicketIdentity,
    db?: unknown,
  ): Promise<PersistedArcaTicket | null>;
  upsertTicket(ticket: PersistedArcaTicket, db?: unknown): Promise<void>;
  deleteTicket(identity: ArcaTicketIdentity, db?: unknown): Promise<void>;
};

export type ArcaTicketLock = <T>(
  identity: ArcaTicketIdentity,
  task: (db: unknown) => Promise<T>,
) => Promise<T>;

export function arcaTicketContext(identity: ArcaTicketIdentity): string {
  return `${identity.environment}|${identity.service}|${identity.certificateFingerprint}`;
}
