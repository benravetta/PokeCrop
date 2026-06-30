import { describe, expect, it } from "vitest";
import { buildSearchQueries, buildEbaySoldSearchUrl } from "./ebaySearchQueryBuilder.js";

describe("ebaySearchQueryBuilder", () => {
  it("builds sold search URL with required params", () => {
    const url = buildEbaySoldSearchUrl("Pokemon Ninetales 12/102");
    expect(url).toContain("ebay.co.uk");
    expect(url).toContain("LH_Complete=1");
    expect(url).toContain("LH_Sold=1");
    expect(url).toContain("_sop=13");
  });

  it("keeps material identifiers in fallback queries", () => {
    const queries = buildSearchQueries({
      cardName: "Ninetales",
      setName: "Base Set",
      cardNumber: "12/102",
      edition: "1st Edition",
      conditionType: "raw",
    });
    expect(queries[0]).toMatch(/Ninetales/);
    expect(queries[0]).toMatch(/12\/102/);
    expect(queries[0]).toMatch(/1st Edition/);
  });

  it("generates multi-alias query set for exhaustive sold search", () => {
    const queries = buildSearchQueries({
      game: "Pokemon",
      cardName: "Pikachu",
      setName: "Wizards Black Star Promos",
      cardNumber: "27",
      edition: "Unlimited",
      finish: "Holo",
      language: "English",
      conditionType: "raw",
    });
    expect(queries.length).toBeGreaterThan(6);
    expect(queries.some((q) => /raw|ungraded/i.test(q))).toBe(true);
    expect(queries.some((q) => /PSA|BGS|CGC/.test(q))).toBe(true);
  });
});
