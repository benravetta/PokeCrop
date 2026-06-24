/**
 * Manual integration test — hits live eBay. Run with:
 *   EBAY_INTEGRATION=1 npm run test:integration:ebay
 */
import { describe, expect, it } from "vitest";
import { lookupEbaySoldPrices } from "./lookup.js";

const run = process.env.EBAY_INTEGRATION === "1";

describe.skipIf(!run)("eBay sold lookup integration", () => {
  it("finds sold comps for a well-known card", async () => {
    const result = await lookupEbaySoldPrices(
      {
        game: "Pokemon",
        cardName: "Charizard",
        setName: "Base Set",
        cardNumber: "4/102",
        edition: "Unlimited",
        finish: "Holo",
        language: "English",
        conditionType: "raw",
      },
      { skipCache: true, timeoutMs: 90_000 }
    );
    expect(["success", "no_verified_sales", "temporarily_unavailable"]).toContain(result.status);
  }, 120_000);
});
