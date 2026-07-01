import { AsyncLocalStorage } from "node:async_hooks";
import type { SignedUrlResult } from "./types";

const signedUrlCacheStorage = new AsyncLocalStorage<
  Map<string, SignedUrlResult>
>();

export function buildSignedUrlCacheKey(
  bucket: string,
  path: string,
): string {
  return `${bucket}\0${path}`;
}

export function getSignedUrlCache(): Map<string, SignedUrlResult> | undefined {
  return signedUrlCacheStorage.getStore();
}

export function runWithSignedUrlCache<T>(operation: () => Promise<T>): Promise<T> {
  return signedUrlCacheStorage.run(new Map(), operation);
}
