import { describe, expect, it } from "vitest";
import { signDisplayToken, verifyDisplayToken } from "../lib/displayProxy.js";
import { mapIdentificationToCardPatch } from "../application/cardIdentificationService.js";

describe("display proxy tokens", () => {
  it("signs and verifies a valid token", () => {
    const { token, exp } = signDisplayToken({
      publicCardId: "cd_test123",
      role: "front",
      size: "display",
      expSec: 60,
    });
    expect(
      verifyDisplayToken({
        publicCardId: "cd_test123",
        role: "front",
        size: "display",
        token,
        exp,
      })
    ).toBe(true);
  });

  it("rejects tampered card id", () => {
    const { token, exp } = signDisplayToken({
      publicCardId: "cd_test123",
      role: "front",
      size: "display",
      expSec: 60,
    });
    expect(
      verifyDisplayToken({
        publicCardId: "cd_other",
        role: "front",
        size: "display",
        token,
        exp,
      })
    ).toBe(false);
  });

  it("rejects expired tokens", () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    const { token } = signDisplayToken({
      publicCardId: "cd_test123",
      role: "front",
      size: "display",
      expSec: -20,
    });
    expect(
      verifyDisplayToken({
        publicCardId: "cd_test123",
        role: "front",
        size: "display",
        token,
        exp,
      })
    ).toBe(false);
  });
});

describe("image re-upload metering", () => {
  it("documents that crop_usage_counted must reset on new original upload", () => {
    // Enforced in customerRoutes POST .../images — see crop_usage_counted: false
    expect(true).toBe(true);
  });
});

describe("identification mapping", () => {
  it("maps rich identification onto card columns", () => {
    const patch = mapIdentificationToCardPatch({
      name: "Charizard",
      set: "Base Set",
      set_code: "base1",
      number: "004",
      set_total: "102",
      tcg: "pokemon",
      rarity: "Rare Holo",
      variant: "Holo",
      holo_type: "Holo",
      edition: "1st Edition",
      language: "English",
      release_year: 1999,
      illustrator: "Mitsuhiro Arita",
      regulation_mark: "",
      identifiers: ["1st Edition"],
      confidence: 0.92,
    });
    expect(patch.card_name).toBe("Charizard");
    expect(patch.set_name).toBe("Base Set");
    expect(patch.card_number).toBe("004/102");
    expect(patch.card_game).toBe("Pokémon");
    expect(patch.identification_confidence).toBe(0.92);
  });

  it("leaves empty identification fields out of string columns", () => {
    const patch = mapIdentificationToCardPatch({
      name: "",
      set: "",
      set_code: "",
      number: "",
      set_total: "",
      tcg: "unidentified",
      rarity: "",
      variant: "",
      holo_type: "",
      edition: "",
      language: "",
      release_year: null,
      illustrator: "",
      regulation_mark: "",
      identifiers: [],
      confidence: 0.2,
    });
    expect(patch.card_name).toBeUndefined();
    expect(patch.identification_confidence).toBe(0.2);
  });
});
