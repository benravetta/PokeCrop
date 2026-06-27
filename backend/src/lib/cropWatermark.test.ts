import { describe, expect, it } from "vitest";
import { shouldWatermarkCrop } from "./cropWatermark.js";

describe("shouldWatermarkCrop", () => {
  it("watermarks free plan users", () => {
    expect(shouldWatermarkCrop({ plan: "free", role: "user" })).toBe(true);
    expect(shouldWatermarkCrop({ billing: "free", role: "user" })).toBe(true);
  });

  it("skips paid plans and admin", () => {
    expect(shouldWatermarkCrop({ plan: "pro", role: "user" })).toBe(false);
    expect(shouldWatermarkCrop({ plan: "unlimited", role: "user" })).toBe(false);
    expect(shouldWatermarkCrop({ plan: "api", role: "user" })).toBe(false);
    expect(shouldWatermarkCrop({ billing: "subscription", plan: "free", role: "user" })).toBe(
      false
    );
    expect(shouldWatermarkCrop({ billing: "one_off", plan: "free", role: "user" })).toBe(false);
    expect(shouldWatermarkCrop({ plan: "free", role: "admin" })).toBe(false);
  });
});

describe("applyCropWatermark", () => {
  it(
    "returns a PNG buffer",
    async () => {
      const { applyCropWatermark } = await import("./cropWatermark.js");
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      );
      const out = await applyCropWatermark(png);
      expect(out.length).toBeGreaterThan(0);
      expect(out.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    },
    60_000
  );
});
