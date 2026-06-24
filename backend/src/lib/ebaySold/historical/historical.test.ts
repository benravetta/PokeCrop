import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normaliseCardIdentity } from "../cardIdentityNormaliser.js";
import {
  hasContradictoryGrading,
  validateHistoricalRecord,
} from "./historicalSaleMatcher.js";
import { normaliseHistoricalRecords } from "./historicalSaleNormaliser.js";
import { dedupeDirectAndArchived, mergeAndSelectSales } from "./historicalSaleDeduplicator.js";
import { parsePriceChartingSaleRows } from "./priceChartingHistoricalSource.js";
import { parsePsaAuctionRows } from "./psaAuctionHistorySource.js";
import { computeEvidenceMode, calculateSoldPriceStats } from "../soldPriceCalculator.js";
import type { HistoricalSaleRecord, VerifiedSale } from "../types.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const pcFixture = readFileSync(join(__dir, "__fixtures__/pricecharting-sales.html"), "utf8");
const psaFixture = readFileSync(join(__dir, "__fixtures__/psa-auction-ebay.html"), "utf8");

const gradedCard = normaliseCardIdentity({
  game: "Pokemon",
  cardName: "Ninetales",
  setName: "Base Set",
  cardNumber: "12/102",
  edition: "1st Edition",
  finish: "Holo",
  language: "English",
  conditionType: "graded",
  grader: "PSA",
  grade: "10",
});

function directSale(id: string, date: string, gbp: number, title: string): VerifiedSale {
  const url = `https://www.ebay.co.uk/itm/${id}`;
  return {
    ebayItemId: id,
    title,
    url,
    soldDate: date,
    saleFormat: "auction",
    conditionOriginal: "NM",
    conditionNormalised: "near_mint",
    priceOriginal: gbp,
    currencyOriginal: "GBP",
    exchangeRateToGbp: 1,
    priceGbp: gbp,
    matchScore: 100,
    possibleOutlier: false,
    evidenceLevel: "direct",
    verificationStatus: "fully_verified",
    sourceName: "eBay",
    sourceUrl: url,
    marketplace: "eBay",
    originalListingAvailable: true,
    originalEbayUrl: url,
    verificationNotes: [],
  };
}

function archivedSale(
  date: string,
  gbp: number,
  title: string,
  sourceUrl: string,
  ebayId?: string
): VerifiedSale {
  return {
    ebayItemId: ebayId ?? null,
    title,
    url: sourceUrl,
    soldDate: date,
    saleFormat: "unknown",
    conditionOriginal: "NM",
    conditionNormalised: "near_mint",
    priceOriginal: gbp,
    currencyOriginal: "GBP",
    exchangeRateToGbp: 1,
    priceGbp: gbp,
    matchScore: 90,
    possibleOutlier: false,
    evidenceLevel: "archived",
    verificationStatus: "historically_indexed",
    sourceName: "PriceCharting",
    sourceUrl,
    marketplace: "eBay",
    originalListingAvailable: false,
    originalEbayUrl: ebayId ? `https://www.ebay.co.uk/itm/${ebayId}` : null,
    verificationNotes: ["Recovered from PriceCharting public archive"],
  };
}

describe("PriceCharting historical parser", () => {
  it("accepts individual sale rows and ignores market value", () => {
    const rows = parsePriceChartingSaleRows(pcFixture, "https://www.pricecharting.com/game/test");
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => !/market value|aggregate/i.test(r.listingTitle))).toBe(true);
  });

  it("rejects contradictory CGC PSA 10 title", () => {
    const rows = parsePriceChartingSaleRows(pcFixture, "https://www.pricecharting.com/game/test");
    const bad = rows.find((r) => /CGC PSA 10/i.test(r.listingTitle));
    expect(bad).toBeTruthy();
    const v = validateHistoricalRecord(bad!, gradedCard);
    expect(v.accepted).toBe(false);
  });

  it("accepts PSA 10 exact match row", () => {
    const rows = parsePriceChartingSaleRows(pcFixture, "https://www.pricecharting.com/game/test");
    const good = rows.find(
      (r) => r.listingTitle.includes("PSA 10") && !r.listingTitle.includes("CGC")
    );
    expect(good).toBeTruthy();
    const { sales } = normaliseHistoricalRecords([good!], gradedCard);
    expect(sales.length).toBe(1);
    expect(sales[0]!.evidenceLevel).toBe("archived");
  });
});

describe("PSA auction parser", () => {
  it("includes eBay rows only", () => {
    const rows = parsePsaAuctionRows(psaFixture, "https://www.psacard.com/auctionprices/search");
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => /ebay/i.test(r.marketplace))).toBe(true);
    expect(rows.some((r) => /Heritage/i.test(r.listingTitle))).toBe(false);
  });

  it("rejects PSA 9 for PSA 10 request", () => {
    const rows = parsePsaAuctionRows(psaFixture, "https://www.psacard.com/auctionprices/search");
    const nine = rows.find((r) => /PSA 9\b/i.test(r.listingTitle));
    expect(nine).toBeTruthy();
    const v = validateHistoricalRecord(nine!, gradedCard);
    expect(v.accepted).toBe(false);
  });
});

describe("tiered evidence selection", () => {
  it("uses three direct sales only", () => {
    const direct = [
      directSale("1", "2026-06-24", 100, "Pokemon Ninetales 12/102 Base Set 1st Edition Holo"),
      directSale("2", "2026-06-20", 110, "Pokemon Ninetales 12/102 Base Set 1st Edition Holo"),
      directSale("3", "2026-06-18", 120, "Pokemon Ninetales 12/102 Base Set 1st Edition Holo"),
    ];
    const selected = mergeAndSelectSales(direct, [], 3);
    expect(selected).toHaveLength(3);
    expect(computeEvidenceMode(selected)).toBe("direct_only");
  });

  it("combines two direct and one archived", () => {
    const direct = [
      directSale("1", "2026-06-24", 100, "Pokemon Ninetales 12/102 Base Set 1st Edition Holo"),
      directSale("2", "2026-06-20", 110, "Pokemon Ninetales 12/102 Base Set 1st Edition Holo"),
    ];
    const archived = [
      archivedSale(
        "2026-06-15",
        105,
        "Pokemon Ninetales 12/102 Base Set 1st Edition Holo PSA 10",
        "https://www.pricecharting.com/game/test"
      ),
    ];
    const selected = mergeAndSelectSales(direct, archived, 3);
    expect(selected).toHaveLength(3);
    expect(computeEvidenceMode(selected)).toBe("mixed_evidence");
  });

  it("drops archived duplicate of direct sale", () => {
    const direct = [directSale("998877665544", "2026-06-20", 850, "Pokemon Ninetales 12/102 PSA 10")];
    const archived = [
      archivedSale(
        "2026-06-20",
        850,
        "Pokemon Ninetales 12/102 Base Set 1st Edition Holo PSA 10",
        "https://www.pricecharting.com/game/test",
        "998877665544"
      ),
    ];
    const filtered = dedupeDirectAndArchived(direct, archived);
    expect(filtered).toHaveLength(0);
  });

  it("prefers direct over archived on same date", () => {
    const direct = [directSale("1", "2026-06-20", 100, "Pokemon Ninetales 12/102 Base Set 1st Edition Holo")];
    const archived = [
      archivedSale(
        "2026-06-20",
        99,
        "Pokemon Ninetales 12/102 Base Set 1st Edition Holo",
        "https://www.pricecharting.com/game/test"
      ),
    ];
    const merged = mergeAndSelectSales(direct, archived, 2);
    expect(merged[0]!.evidenceLevel).toBe("direct");
  });

  it("calculates average from three valid transactions", () => {
    const sales = [
      directSale("1", "2026-06-24", 100, "a"),
      archivedSale("2026-06-22", 110, "b", "https://pc.test"),
      archivedSale("2026-06-20", 120, "c", "https://pc.test"),
    ];
    const stats = calculateSoldPriceStats(sales);
    expect(stats.averageSoldPriceGbp).toBeCloseTo(110, 2);
    expect(stats.evidenceMode).toBe("mixed_evidence");
  });

  it("rejects archive without sale date", () => {
    const record: HistoricalSaleRecord = {
      sourceName: "PriceCharting",
      sourceUrl: "https://www.pricecharting.com/game/test",
      marketplace: "eBay",
      listingTitle: "Pokemon Ninetales 12/102 Base Set 1st Edition Holo PSA 10",
      saleDate: "",
      soldPriceOriginal: 100,
      currencyOriginal: "GBP",
    };
    expect(validateHistoricalRecord(record, gradedCard).accepted).toBe(false);
  });

  it("rejects contradictory grading helper", () => {
    expect(hasContradictoryGrading("CGC slab PSA 10 holo", "PSA")).toBe(true);
  });
});
