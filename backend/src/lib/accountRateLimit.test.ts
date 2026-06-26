import { describe, expect, it } from "vitest";
import {
  MemoryRateLimitStore,
  resetRateLimitStoreForTests,
} from "./rateLimitStore.js";
import {
  consumeWebRateLimitSlot,
  peekWebRateLimit,
  peekApiRateLimit,
} from "./accountRateLimit.js";

describe("MemoryRateLimitStore peek/consume", () => {
  it("peek does not consume quota", async () => {
    resetRateLimitStoreForTests();
    const store = new MemoryRateLimitStore();
    const peek1 = await store.peek("user-1", "api:crop", 60_000, 2);
    expect(peek1.allowed).toBe(true);
    expect(peek1.count).toBe(0);
    expect(await store.consume("user-1", "api:crop", 60_000, 2)).toBe(true);
    const peek2 = await store.peek("user-1", "api:crop", 60_000, 2);
    expect(peek2.count).toBe(1);
  });

  it("rejects consume when at limit", async () => {
    resetRateLimitStoreForTests();
    const store = new MemoryRateLimitStore();
    expect(await store.consume("user-1", "web:grade", 60_000, 1)).toBe(true);
    expect(await store.consume("user-1", "web:grade", 60_000, 1)).toBe(false);
  });
});

describe("accountRateLimit peek/consume", () => {
  it("peek then consume only charges successful work", async () => {
    resetRateLimitStoreForTests();
    process.env.RATE_LIMIT_STORE = "memory";
    process.env.WEB_GRADE_PER_MIN = "1";

    const peek = await peekWebRateLimit("user-a", "web:grade");
    expect(peek.allowed).toBe(true);

    await consumeWebRateLimitSlot("user-a", "web:grade");

    const blocked = await peekWebRateLimit("user-a", "web:grade");
    expect(blocked.allowed).toBe(false);
  });

  it("failed validation path can peek without consuming", async () => {
    resetRateLimitStoreForTests();
    process.env.RATE_LIMIT_STORE = "memory";
    process.env.WEB_GRADE_PER_MIN = "1";

    expect((await peekWebRateLimit("user-b", "web:grade")).allowed).toBe(true);
    expect((await peekWebRateLimit("user-b", "web:grade")).allowed).toBe(true);
  });

  it("peeks api crop without consuming", async () => {
    resetRateLimitStoreForTests();
    process.env.RATE_LIMIT_STORE = "memory";
    process.env.API_RATE_PER_MIN = "2";

    const peek = await peekApiRateLimit("user-c", "crop");
    expect(peek.allowed).toBe(true);
    expect(peek.remaining).toBe(2);
  });
});
