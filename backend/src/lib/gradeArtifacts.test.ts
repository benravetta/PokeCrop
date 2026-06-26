import { describe, expect, it } from "vitest";
import { artifactKeyFromDetail } from "./gradeArtifacts.js";

describe("artifactKeyFromDetail", () => {
  it("reads pdf and zip keys from detail.artifacts", () => {
    const detail = {
      artifacts: {
        pdfKey: "users/u1/grades/1/report.pdf",
        zipKey: "users/u1/grades/1/bundle.zip",
      },
    };
    expect(artifactKeyFromDetail(detail, "pdf")).toBe("users/u1/grades/1/report.pdf");
    expect(artifactKeyFromDetail(detail, "zip")).toBe("users/u1/grades/1/bundle.zip");
  });

  it("returns null when artifacts missing", () => {
    expect(artifactKeyFromDetail({}, "pdf")).toBeNull();
    expect(artifactKeyFromDetail(null, "zip")).toBeNull();
  });
});

describe("isOwnedArtifactKey", () => {
  it("accepts keys under the user prefix only", async () => {
    const { isOwnedArtifactKey } = await import("./gradeArtifacts.js");
    const uid = "abc-123";
    expect(isOwnedArtifactKey(`users/${uid}/grades/1/report.pdf`, uid)).toBe(true);
    expect(isOwnedArtifactKey(`users/other/grades/1/report.pdf`, uid)).toBe(false);
    expect(isOwnedArtifactKey(`users/${uid}/grades/../secret`, uid)).toBe(false);
  });
});

describe("persistGradeArtifacts", () => {
  it("returns null when R2 is not configured", async () => {
    const prev = process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCOUNT_ID;
    const { persistGradeArtifacts } = await import("./gradeArtifacts.js");
    const result = await persistGradeArtifacts({
      userId: "user-1",
      eventId: 42,
      result: { card_identification: { name: "Pikachu" } },
      files: {
        front: [
          {
            buffer: Buffer.from([1, 2, 3]),
            originalname: "front.jpg",
            mimetype: "image/jpeg",
            fieldname: "front",
            encoding: "7bit",
            size: 3,
            stream: null as never,
            destination: "",
            filename: "",
            path: "",
          },
        ],
      },
    });
    if (prev) process.env.R2_ACCOUNT_ID = prev;
    expect(result).toBeNull();
  });
});
