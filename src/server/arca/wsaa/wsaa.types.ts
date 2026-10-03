import "server-only";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";

/** Ticket de acceso WSAA. Solo servidor. No serializar hacia el cliente. */
export type ArcaAccessTicket = {
  token: string;
  sign: string;
  generationTime: Date;
  expirationTime: Date;
  service: string;
  environment: ArcaEnvironment;
};

export type LoginTicketRequest = {
  xml: string;
  uniqueId: number;
  generationTime: Date;
  expirationTime: Date;
};
