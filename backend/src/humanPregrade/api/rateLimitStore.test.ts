import { describe, expect, it } from "vitest";
import { MemoryRateLimitStore, resetRateLimitStoreForTests } from "./rateLimitStore.js";

describe("MemoryRateLimitStore", () => {
  it("allows requests up to the limit within a window", async () => {
    resetRateLimitStoreForTests();
    const store = new MemoryRateLimitStore();
    const windowMs = 60_000;
    const limit = 3;

    expect(await store.checkAndIncrement("user-1", "upload", windowMs, limit)).toBe(true);
    expect(await store.checkAndIncrement("user-1", "upload", windowMs, limit)).toBe(true);
    expect(await store.checkAndIncrement("user-1", "upload", windowMs, limit)).toBe(true);
    expect(await store.checkAndIncrement("user-1", "upload", windowMs, limit)).toBe(false);
  });

  it("tracks actions independently per user", async () => {
    resetRateLimitStoreForTests();
    const store = new MemoryRateLimitStore();
    const windowMs = 60_000;
    const limit = 1;

    expect(await store.checkAndIncrement("user-a", "checkout", windowMs, limit)).toBe(true);
    expect(await store.checkAndIncrement("user-a", "checkout", windowMs, limit)).toBe(false);
    expect(await store.checkAndIncrement("user-b", "checkout", windowMs, limit)).toBe(true);
  });
});
