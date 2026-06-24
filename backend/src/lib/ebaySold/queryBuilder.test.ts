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
});
