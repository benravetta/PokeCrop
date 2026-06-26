import { describe, expect, it } from "vitest";
import { parseCentering } from "./gradeService.js";

describe("parseCentering", () => {
  it("accepts JSON string payloads from multipart grade uploads", () => {
    const out = parseCentering(
      JSON.stringify({ front: { leftRight: "55/45", topBottom: "50/50" } })
    );
    expect(out?.front?.leftRight).toBe("55/45");
  });

  it("accepts plain objects from JSON centering-preview requests", () => {
    const out = parseCentering({
      front: { leftRight: "52/48", topBottom: "50/50" },
      measurement_confidence: 0.9,
    });
    expect(out?.front?.leftRight).toBe("52/48");
    expect(out?.measurement_confidence).toBe(0.9);
  });

  it("rejects invalid ratio strings", () => {
    const out = parseCentering({ front: { leftRight: "bad", topBottom: "50/50" } });
    expect(out?.front?.leftRight).toBeUndefined();
    expect(out?.front?.topBottom).toBe("50/50");
  });
});
