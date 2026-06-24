import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normaliseCardIdentity } from "./cardIdentityNormaliser.js";
import { scoreListingMatch } from "./cardListingMatcher.js";
import { parseEbaySearchHtml, parsePrice, parseSoldDate } from "./ebayHtmlParser.js";
import { verifyListingCandidate } from "./ebayListingVerifier.js";
import {
  calculateSoldPriceStats,
  markOutliers,
  selectTopRecentSales,
} from "./soldPriceCalculator.js";
import { calculateValuationConfidence } from "./valuationConfidenceCalculator.js";
import { convertToGbp, resetExchangeRatesForTests } from "./currencyConverter.js";
import type { VerifiedSale } from "./types.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dir, "__fixtures__/ebay-search-ninetales.html"), "utf8");

const baseCard = normaliseCardIdentity({
  game: "Pokemon",
  cardName: "Ninetales",
  setName: "Base Set",
  cardNumber: "12/102",
  edition: "1st Edition",
  finish: "Holo",
  language: "English",
  conditionType: "raw",
});

function saleFixture(partial: Partial<VerifiedSale> & Pick<VerifiedSale, "soldDate" | "priceGbp" | "priceOriginal">): VerifiedSale {
  return {
    ebayItemId: partial.ebayItemId ?? "1",
    title: partial.title ?? "Pokemon Ninetales 12/102",
    url: partial.url ?? "https://www.ebay.co.uk/itm/1",
    saleFormat: partial.saleFormat ?? "auction",
    conditionOriginal: partial.conditionOriginal ?? "NM",
    conditionNormalised: partial.conditionNormalised ?? "near_mint",
    currencyOriginal: partial.currencyOriginal ?? "GBP",
    exchangeRateToGbp: partial.exchangeRateToGbp ?? 1,
    matchScore: partial.matchScore ?? 100,
    possibleOutlier: partial.possibleOutlier ?? false,
    evidenceLevel: partial.evidenceLevel ?? "direct",
    verificationStatus: partial.verificationStatus ?? "fully_verified",
    sourceName: partial.sourceName ?? "eBay",
    sourceUrl: partial.sourceUrl ?? partial.url ?? "https://www.ebay.co.uk/itm/1",
    marketplace: partial.marketplace ?? "eBay",
    originalListingAvailable: partial.originalListingAvailable ?? true,
    originalEbayUrl: partial.originalEbayUrl ?? partial.url ?? "https://www.ebay.co.uk/itm/1",
    verificationNotes: partial.verificationNotes ?? [],
    ...partial,
  };
}

describe("cardListingMatcher", () => {
  it("accepts 1st Edition holo Ninetales 12/102", () => {
    const r = scoreListingMatch(
      baseCard,
      "Pokemon Ninetales 12/102 Base Set 1st Edition Holo NM"
    );
    expect(r.accepted).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(85);
  });

  it("rejects Unlimited when 1st Edition requested", () => {
    const r = scoreListingMatch(baseCard, "Pokemon Ninetales 12/102 Base Set Unlimited Holo");
    expect(r.accepted).toBe(false);
    expect(r.fatalReason).toMatch(/1st Edition/i);
  });

  it("rejects bundle listings", () => {
    const r = scoreListingMatch(baseCard, "Pokemon Base Set job lot bundle 50 cards");
    expect(r.accepted).toBe(false);
  });

  it("rejects PSA graded for raw search", () => {
    const r = scoreListingMatch(baseCard, "Pokemon Ninetales 12/102 PSA 9 Base Set Holo");
    expect(r.accepted).toBe(false);
  });

  it("rejects wrong card number", () => {
    const r = scoreListingMatch(baseCard, "Pokemon Ninetales 13/102 Base Set 1st Edition Holo");
    expect(r.accepted).toBe(false);
  });

  it("rejects Japanese when English requested", () => {
    const r = scoreListingMatch(baseCard, "Pokemon Ninetales 12/102 Japanese Base Set Holo");
    expect(r.accepted).toBe(false);
  });

  it("rejects reverse holo when holo requested", () => {
    const r = scoreListingMatch(
      baseCard,
      "Pokemon Ninetales 12/102 Base Set 1st Edition Reverse Holo"
    );
    expect(r.accepted).toBe(false);
  });

  it("requires exact PSA grade for graded search", () => {
    const graded = normaliseCardIdentity({
      ...baseCard,
      conditionType: "graded",
      grader: "PSA",
      grade: "10",
    });
    expect(scoreListingMatch(graded, "Pokemon Ninetales 12/102 Base Set 1st Edition Holo PSA 9").accepted).toBe(false);
    expect(scoreListingMatch(graded, "Pokemon Ninetales 12/102 Base Set 1st Edition Holo PSA 10").accepted).toBe(true);
  });
});

describe("ebayHtmlParser", () => {
  it("parses fixture listings", () => {
    const { candidates, blocked } = parseEbaySearchHtml(fixture);
    expect(blocked).toBe(false);
    expect(candidates.length).toBeGreaterThanOrEqual(3);
  });

  it("parses GBP and USD prices", () => {
    expect(parsePrice("£1,299.99")).toEqual({ amount: 1299.99, currency: "GBP" });
    expect(parsePrice("US $450.00")).toEqual({ amount: 450, currency: "USD" });
    expect(parsePrice("JPY 20,000")).toEqual({ amount: 20000, currency: "JPY" });
  });

  it("parses sold dates", () => {
    expect(parseSoldDate("Sold 24 Jun 2026")).toBe("2026-06-24");
    expect(parseSoldDate("24/06/2026")).toBe("2026-06-24");
  });

  it("detects CAPTCHA pages", () => {
    const r = parseEbaySearchHtml("<html>verify you are a human captcha</html>");
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toBe("CAPTCHA_REQUIRED");
  });
});

describe("verification pipeline", () => {
  it("excludes unverified best offer listings", () => {
    const { candidates } = parseEbaySearchHtml(fixture);
    const bo = candidates.find((c) => /best offer/i.test(c.displayedPrice));
    expect(bo).toBeTruthy();
    const out = verifyListingCandidate(bo!, { identity: baseCard, postageExcluded: true });
    expect(out.accepted).toBe(false);
    expect(out.excludeReason?.code).toBe("UNVERIFIED_BEST_OFFER");
  });

  it("accepts exact matches from fixture", () => {
    const { candidates } = parseEbaySearchHtml(fixture);
    const accepted = candidates.filter(
      (c) => verifyListingCandidate(c, { identity: baseCard, postageExcluded: true }).accepted
    );
    expect(accepted.length).toBeGreaterThanOrEqual(2);
  });
});

describe("soldPriceCalculator", () => {
  const sales: VerifiedSale[] = [
    saleFixture({ ebayItemId: "1", title: "a", url: "https://www.ebay.co.uk/itm/1", soldDate: "2026-06-24", priceOriginal: 100, priceGbp: 100 }),
    saleFixture({ ebayItemId: "2", title: "b", url: "https://www.ebay.co.uk/itm/2", soldDate: "2026-06-20", priceOriginal: 130, priceGbp: 130 }),
    saleFixture({ ebayItemId: "3", title: "c", url: "https://www.ebay.co.uk/itm/3", soldDate: "2026-06-18", priceOriginal: 160, priceGbp: 160 }),
  ];

  it("calculates three-sale average", () => {
    const top = selectTopRecentSales(sales, 3);
    const stats = calculateSoldPriceStats(top);
    expect(stats.salesUsed).toBe(3);
    expect(stats.averageSoldPriceGbp).toBeCloseTo(130, 2);
  });

  it("labels two-sale limited average", () => {
    const stats = calculateSoldPriceStats(sales.slice(0, 2));
    expect(stats.limitedAverageLabel).toMatch(/2 verified sales/i);
    expect(stats.averageSoldPriceGbp).toBe(115);
  });

  it("flags outliers", () => {
    const spreadSales: VerifiedSale[] = [
      saleFixture({ ebayItemId: "1", title: "a", url: "https://www.ebay.co.uk/itm/1", soldDate: "2026-06-24", priceOriginal: 100, priceGbp: 100 }),
      saleFixture({ ebayItemId: "2", title: "b", url: "https://www.ebay.co.uk/itm/2", soldDate: "2026-06-20", priceOriginal: 120, priceGbp: 120 }),
      saleFixture({ ebayItemId: "3", title: "c", url: "https://www.ebay.co.uk/itm/3", soldDate: "2026-06-18", priceOriginal: 250, priceGbp: 250 }),
    ];
    const outlierSales = markOutliers(spreadSales);
    expect(outlierSales.some((s) => s.possibleOutlier)).toBe(true);
  });
});

describe("currencyConverter", () => {
  it("converts USD to GBP using config", () => {
    resetExchangeRatesForTests();
    const r = convertToGbp(100, "USD");
    expect(r?.gbp).toBe(79);
  });
});

describe("confidence", () => {
  it("caps confidence below 70 with fewer than three sales", () => {
    const stats = calculateSoldPriceStats([
      saleFixture({ soldDate: "2026-06-24", priceOriginal: 100, priceGbp: 100 }),
    ]);
    const c = calculateValuationConfidence(
      [saleFixture({ soldDate: "2026-06-24", priceOriginal: 100, priceGbp: 100 })],
      stats,
      {
        staleFx: false,
        partialDates: false,
        accessoryListings: 0,
        archivedMissingCardNumber: 0,
        archivedMissingEbayId: 0,
        unclearArchivedTitles: 0,
        inferredCurrency: 0,
      }
    );
    expect(c.score).toBeLessThanOrEqual(70);
  });
});
