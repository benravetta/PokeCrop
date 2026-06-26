import { describe, expect, it } from "vitest";
import { validateImageBuffer, validateImageAtPath } from "./uploadValidation.js";
import fs from "fs";
import os from "os";
import path from "path";

describe("validateImageBuffer", () => {
  it("accepts JPEG magic bytes", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(validateImageBuffer(buf)).toEqual({ ok: true, ext: ".jpg" });
  });

  it("accepts PNG magic bytes", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateImageBuffer(buf)).toEqual({ ok: true, ext: ".png" });
  });

  it("accepts PDF when allowed", () => {
    const buf = Buffer.from("%PDF-1.4\n");
    expect(validateImageBuffer(buf, { allowPdf: true })).toEqual({ ok: true, ext: ".pdf" });
  });

  it("rejects PDF for grade uploads", () => {
    const buf = Buffer.from("%PDF-1.4\n");
    expect(validateImageBuffer(buf, { allowPdf: false }).ok).toBe(false);
  });

  it("rejects unknown bytes", () => {
    const buf = Buffer.from("not-an-image");
    expect(validateImageBuffer(buf).ok).toBe(false);
  });
});

describe("validateImageAtPath", () => {
  it("sniffs bytes from disk", async () => {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pokecrop-test-"));
    const filePath = path.join(dir, "test.jpg");
    await fs.promises.writeFile(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    const out = await validateImageAtPath(filePath);
    expect(out.ok).toBe(true);
    await fs.promises.rm(dir, { recursive: true, force: true });
  });
});

describe("parseCentering object support", () => {
  it("accepts JSON objects for centering-preview", async () => {
    const { parseCentering } = await import("./gradeService.js");
    const out = parseCentering({
      front: { leftRight: "55/45", topBottom: "50/50" },
    });
    expect(out?.front?.leftRight).toBe("55/45");
  });
});
