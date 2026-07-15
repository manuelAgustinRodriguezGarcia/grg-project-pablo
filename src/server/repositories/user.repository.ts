import type { User, UserRole, UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export type UpsertUserFromAuthInput = {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
  status?: UserStatus;
};

export type UpdateUserProfileInput = {
  name?: string;
  email?: string;
  role?: UserRole;
};

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findAll(): Promise<User[]> {
    return prisma.user.findMany({
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });
  }

  async upsertFromAuth(input: UpsertUserFromAuthInput): Promise<User> {
    const { id, email, name, role, status } = input;

    return prisma.user.upsert({
      where: { id },
      create: {
        id,
        email,
        name,
        role: role ?? "USUARIO",
        status: status ?? "ACTIVE",
      },
      update: {
        email,
        name,
        ...(role !== undefined ? { role } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    });
  }

  async touchLastAccess(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastAccessAt: new Date() },
    });
  }

  async touchLastAccessIfStale(
    id: string,
    minIntervalMs = 10 * 60 * 1000,
    knownLastAccessAt?: Date | null,
  ): Promise<void> {
    if (knownLastAccessAt !== undefined) {
      const lastAccessAt = knownLastAccessAt?.getTime() ?? 0;
      if (Date.now() - lastAccessAt < minIntervalMs) {
        return;
      }

      await this.touchLastAccess(id);
      return;
    }

    const threshold = new Date(Date.now() - minIntervalMs);

    // Single conditional update — no prior findUnique round-trip.
    await prisma.user.updateMany({
      where: {
        id,
        OR: [{ lastAccessAt: null }, { lastAccessAt: { lt: threshold } }],
      },
      data: { lastAccessAt: new Date() },
    });
  }

  async setStatus(id: string, status: UserStatus): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  async updateProfile(id: string, input: UpdateUserProfileInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
      },
    });
  }
}

export const userRepository = new UserRepository();
