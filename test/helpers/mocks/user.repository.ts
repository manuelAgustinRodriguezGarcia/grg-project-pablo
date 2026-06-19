import { vi } from "vitest";
import { userRepository } from "@/server/repositories/user.repository";
import { adminUserFixture, createUserFixture } from "../fixtures/user.fixture";

export function setupUserRepositoryMocks(): void {
  vi.mocked(userRepository.findAll).mockResolvedValue([adminUserFixture]);
  vi.mocked(userRepository.findById).mockResolvedValue(null);
  vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
  vi.mocked(userRepository.upsertFromAuth).mockImplementation(async (input) =>
    createUserFixture({
      id: input.id,
      email: input.email,
      name: input.name,
      role: input.role,
      status: input.status ?? "ACTIVE",
    }),
  );
  vi.mocked(userRepository.updateProfile).mockImplementation(async (id, data) =>
    createUserFixture({
      id,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
    }),
  );
  vi.mocked(userRepository.setStatus).mockImplementation(async (id, status) =>
    createUserFixture({ id, status }),
  );
  vi.mocked(userRepository.touchLastAccess).mockResolvedValue(undefined);
}
