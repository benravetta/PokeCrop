import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSupabaseProjectRef,
  isSupabaseManagementConfigured,
  syncSupabaseSignupGate,
} from "./supabaseManagement.js";

describe("supabaseManagement", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.unstubAllGlobals();
  });

  it("derives project ref from SUPABASE_URL", () => {
    delete process.env.SUPABASE_PROJECT_REF;
    process.env.SUPABASE_URL = "https://wymzhmbjlfaoahlhzhgd.supabase.co";
    expect(getSupabaseProjectRef()).toBe("wymzhmbjlfaoahlhzhgd");
  });

  it("prefers SUPABASE_PROJECT_REF over URL host", () => {
    process.env.SUPABASE_PROJECT_REF = "custom-ref";
    process.env.SUPABASE_URL = "https://other.supabase.co";
    expect(getSupabaseProjectRef()).toBe("custom-ref");
  });

  it("is configured when token and ref are present", () => {
    process.env.SUPABASE_ACCESS_TOKEN = "sbp_test";
    process.env.SUPABASE_URL = "https://abc.supabase.co";
    expect(isSupabaseManagementConfigured()).toBe(true);
  });

  it("skips Management API when token is missing", async () => {
    delete process.env.SUPABASE_ACCESS_TOKEN;
    process.env.SUPABASE_URL = "https://abc.supabase.co";
    await expect(syncSupabaseSignupGate(true)).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("PATCHes disable_signup when configured", async () => {
    process.env.SUPABASE_ACCESS_TOKEN = "sbp_test";
    process.env.SUPABASE_URL = "https://abc.supabase.co";
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as Response);

    await expect(syncSupabaseSignupGate(true)).resolves.toBe(true);

    expect(fetch).toHaveBeenCalledWith(
      "https://api.supabase.com/v1/projects/abc/config/auth",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          Authorization: "Bearer sbp_test",
        }),
        body: JSON.stringify({ disable_signup: true }),
      })
    );
  });

  it("maps public registration to disable_signup false", async () => {
    process.env.SUPABASE_ACCESS_TOKEN = "sbp_test";
    process.env.SUPABASE_URL = "https://abc.supabase.co";
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as Response);

    await syncSupabaseSignupGate(false);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ disable_signup: false }),
      })
    );
  });
});
