import { describe, expect, it } from "vitest";
import { CropQuotaExceededError } from "../../lib/cropQuota.js";

describe("crop quota errors", () => {
  it("exposes plan limit metadata for 402 responses", () => {
    const err = new CropQuotaExceededError("free", 3, 0);
    expect(err.status).toBe(402);
    expect(err.code).toBe("crop_quota_exceeded");
    expect(err.limit).toBe(3);
    expect(err.remaining).toBe(0);
  });
});
