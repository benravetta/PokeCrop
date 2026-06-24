/**
 * Card pricing via AI web research + public page grounding.
 * No Cardmarket / PriceCharting / eBay developer APIs — the model searches the web
 * for sold listings and price-guide pages for the exact identified card.
 */

import { chatComplete, isOpenAiConfigured, responsesWebSearch } from "./openai.js";
import { fetchPublicMarketSnippets, formatSnippetsForPrompt } from "./publicMarketPages.js";
import { bandFromPrices, type MarketComp, type PriceBand } from "./marketComps.js";
import {
  companyLikelyGrades,
  type CardPricing,
  type PriceIdentity,
} from "./cardPricing.js";
import { companyMatches, listingMatchesCard } from "./marketMatch.js";

const RESEARCH_MODEL = process.env.CARD_PRICE_RESEARCH_MODEL || "gpt-4o";
const EXTRACT_MODEL = process.env.CARD_PRICE_EXTRACT_MODEL || "gpt-4o-mini";

const ALLOWED_URL =
  /^(https?:\/\/)?(www\.)?(ebay\.(co\.uk|com)|pricecharting\.com|cardmarket\.com)\//i;

const RESEARCH_INSTRUCTIONS =
  "You are a UK trading-card market researcher. You MUST use web search — never answer from " +
  "training memory alone. Search eBay UK completed/sold listings and PriceCharting (and " +
  "Cardmarket if useful) for the EXACT card described. Only report listings that match the " +
  "same card name, set or era, and collector number. Exclude lots, bundles, proxies, and " +
  "different printings. Quote prices in GBP when shown; convert USD/EUR with approximate " +
  "rates only when the listing currency is explicit. List each comp on its own line with " +
  "title, price, and URL.";

const EXTRACT_SYSTEM =
  "You extract structured market comps from provided web research text ONLY. " +
  "Never invent prices or URLs. If a price is not explicitly in the text, omit that comp. " +
  "Output ONLY valid JSON.";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseGbp(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return Math.round(v * 100) / 100;
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const gbp = s.match(/£\s*([\d,]+(?:\.\d{1,2})?)/);
  if (gbp) return Math.round(Number(gbp[1]!.replace(/,/g, "")) * 100) / 100;
  const usd = s.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (usd) {
    const rate = Number(process.env.USD_TO_GBP || "0.79");
    return Math.round(Number(usd[1]!.replace(/,/g, "")) * rate * 100) / 100;
  }
  const eur = s.match(/€\s*([\d,]+(?:\.\d{1,2})?)/);
  if (eur) {
    const rate = Number(process.env.EUR_TO_GBP || "0.85");
    return Math.round(Number(eur[1]!.replace(/,/g, "")) * rate * 100) / 100;
  }
  const bare = Number(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(bare) && bare > 0 ? Math.round(bare * 100) / 100 : null;
}

function sourceFromUrl(url: string): MarketComp["source"] | null {
  const u = url.toLowerCase();
  if (u.includes("ebay.")) return "ebay";
  if (u.includes("pricecharting.com")) return "pricecharting";
  if (u.includes("cardmarket.com")) return "cardmarket";
  return null;
}

function identityParts(identity: PriceIdentity): {
  name: string;
  set: string;
  number: string;
  variant: string;
} {
  return {
    name: str(identity.name),
    set: str(identity.set),
    number: str(identity.number),
    variant: str(identity.variant),
  };
}

function buildResearchPrompt(
  parts: ReturnType<typeof identityParts>,
  gradedTargets: { company: string; grade: string }[]
): string {
  const lines = [
    "Find recent UK-relevant market comps for this exact trading card:",
    `- Name: ${parts.name}`,
    parts.set ? `- Set: ${parts.set}` : "",
    parts.number ? `- Collector number: ${parts.number}` : "",
    parts.variant ? `- Variant / foil: ${parts.variant}` : "",
    "",
    "Search tasks (use web search for each):",
    `1) eBay UK sold/completed listings: "${parts.name}" ${parts.set ?? ""} ${parts.number ? `#${parts.number}` : ""} pokemon card`,
    `2) PriceCharting product page and grade-specific values for the same card`,
  ];
  if (gradedTargets.length) {
    lines.push("");
    lines.push("Also find sold or listed prices at these graded levels (exact grader + grade):");
    for (const g of gradedTargets.slice(0, 5)) {
      lines.push(`- ${g.company} ${g.grade}`);
    }
  }
  lines.push("");
  lines.push(
    "Return a bullet list of matching comps only. Each bullet: listing title, price (GBP preferred), source site, and URL."
  );
  return lines.filter(Boolean).join("\n");
}

interface RawExtractedComp {
  source?: string;
  kind?: string;
  priceGbp?: unknown;
  title?: string;
  url?: string;
  company?: string;
  grade?: string;
}

function priceAppearsInCorpus(price: number, corpus: string): boolean {
  const p = price.toFixed(2);
  const pShort = String(Math.round(price * 100) / 100);
  const variants = [p, pShort, p.replace(".00", ""), `£${p}`, `£${pShort}`];
  const lower = corpus.toLowerCase();
  return variants.some((v) => lower.includes(v.toLowerCase()));
}

function validateComp(
  raw: RawExtractedComp,
  parts: ReturnType<typeof identityParts>,
  corpus: string
): MarketComp | null {
  const title = str(raw.title);
  const url = str(raw.url);
  const priceGbp = parseGbp(raw.priceGbp);
  if (!title || !url || priceGbp == null) return null;
  if (!ALLOWED_URL.test(url)) return null;

  const source = sourceFromUrl(url) ?? (str(raw.source) as MarketComp["source"]);
  if (!source || !["ebay", "pricecharting", "cardmarket"].includes(source)) return null;

  if (!listingMatchesCard(title, parts)) return null;
  if (!priceAppearsInCorpus(priceGbp, corpus)) return null;

  const kind = str(raw.kind).toLowerCase() === "graded" ? "graded" : "raw";
  return {
    source,
    kind,
    priceGbp,
    company: kind === "graded" ? str(raw.company) || undefined : undefined,
    grade: kind === "graded" ? str(raw.grade) || undefined : undefined,
    label: title.slice(0, 140),
  };
}

function confidenceFrom(comps: MarketComp[], rawBand: PriceBand | null): CardPricing["confidence"] {
  const sources = new Set(comps.map((c) => c.source));
  const n = comps.length;
  if (n >= 5 && sources.size >= 2) return "high";
  if (n >= 3 || (rawBand && rawBand.count >= 3)) return "medium";
  return "low";
}

function pricingSource(sources: Set<string>): CardPricing["source"] {
  if (sources.size > 1) return "mixed";
  if (sources.has("ebay")) return "ebay";
  if (sources.has("pricecharting")) return "pricecharting";
  if (sources.has("cardmarket")) return "cardmarket";
  return "mixed";
}

function compsToPricing(
  comps: MarketComp[],
  gradedTargets: { company: string; grade: string }[],
  notes: string
): CardPricing | null {
  if (!comps.length) return null;

  const rawPrices = comps.filter((c) => c.kind === "raw").map((c) => c.priceGbp);
  const rawBand = bandFromPrices(rawPrices);
  if (!rawBand || rawBand.count < 2) return null;

  const gradedOut: CardPricing["graded"] = [];
  for (const g of gradedTargets) {
    const prices = comps
      .filter(
        (c) =>
          c.kind === "graded" &&
          companyMatches(c.company, g.company) &&
          (!c.grade ||
            c.grade === g.grade ||
            c.grade.includes(g.grade.replace(/[^\d.]/g, "")))
      )
      .map((c) => c.priceGbp);
    const band = bandFromPrices(prices);
    if (!band || band.count < 1) continue;
    gradedOut.push({
      company: g.company,
      grade: g.grade,
      low: band.low,
      high: band.high,
    });
  }

  const sources = new Set(comps.map((c) => c.source));
  const rawSource = comps.some((c) => c.source === "ebay" && c.kind === "raw")
    ? "ebay"
    : comps.some((c) => c.source === "pricecharting" && c.kind === "raw")
      ? "pricecharting"
      : comps.some((c) => c.source === "cardmarket" && c.kind === "raw")
        ? "cardmarket"
        : "ebay";

  return {
    currency: "GBP",
    raw: { low: rawBand.low, high: rawBand.high },
    graded: gradedOut,
    confidence: confidenceFrom(comps, rawBand),
    note:
      notes ||
      `Web-researched comps (${comps.length} data points from ${[...sources].join(" + ")}). Not a guaranteed sale price.`,
    source: pricingSource(sources),
    rawSource,
    asOf: new Date().toISOString().slice(0, 10),
    compCount: comps.length,
  };
}

export async function researchCardPricesWeb(
  identity: PriceIdentity,
  companyEstimates: unknown,
  userId: string,
  opts: { timeoutMs?: number } = {}
): Promise<CardPricing | null> {
  if (!isOpenAiConfigured()) return null;

  const parts = identityParts(identity);
  const idConfidence = str(identity.confidence).toLowerCase();
  if (!parts.name || idConfidence === "low") return null;
  if (!parts.set && !parts.number) return null;

  const gradedTargets = companyLikelyGrades(companyEstimates);
  const budget = opts.timeoutMs ?? 45_000;
  const researchMs = Math.max(20_000, Math.floor(budget * 0.65));
  const extractMs = Math.max(8_000, budget - researchMs);

  const snippets = await fetchPublicMarketSnippets(parts);
  const snippetText = formatSnippetsForPrompt(snippets);

  const research = await responsesWebSearch({
    model: RESEARCH_MODEL,
    instructions: RESEARCH_INSTRUCTIONS,
    input: buildResearchPrompt(parts, gradedTargets),
    feature: "card_price_web_research",
    userId,
    timeoutMs: researchMs,
  });

  const researchText = [
    research?.text ?? "",
    research?.citations?.length
      ? "\nCitations:\n" + research.citations.map((c) => `- ${c.title ?? ""} ${c.url}`).join("\n")
      : "",
    "\n\nPublic page snippets:\n",
    snippetText,
  ].join("");

  if (!research && !snippets.ebaySoldLines.length && !snippets.priceChartingText) {
    return null;
  }

  const extract = await chatComplete({
    model: EXTRACT_MODEL,
    system: EXTRACT_SYSTEM,
    user:
      `Extract market comps for this EXACT card from the research text below.\n` +
      `Card: name="${parts.name}" set="${parts.set}" number="${parts.number}" variant="${parts.variant}"\n` +
      `Graded targets: ${gradedTargets.map((g) => `${g.company} ${g.grade}`).join("; ") || "none"}\n\n` +
      `RESEARCH:\n${researchText.slice(0, 14_000)}\n\n` +
      `Return ONLY JSON:\n` +
      `{"comps":[{"source":"ebay|pricecharting|cardmarket","kind":"raw|graded","priceGbp":number,"title":"listing title","url":"https://...","company":"","grade":""}],"notes":""}\n` +
      `Rules: comps must match this exact card; priceGbp must appear in RESEARCH; url required; exclude lots/bundles; empty comps if none found.`,
    jsonObject: true,
    maxTokens: 1800,
    feature: "card_price_extract",
    userId,
    timeoutMs: extractMs,
  });

  if (!extract) return null;

  let parsed: { comps?: RawExtractedComp[]; notes?: string };
  try {
    parsed = JSON.parse(extract.content) as { comps?: RawExtractedComp[]; notes?: string };
  } catch {
    return null;
  }

  const corpus = researchText;
  const comps: MarketComp[] = [];
  for (const raw of parsed.comps ?? []) {
    const comp = validateComp(raw, parts, corpus);
    if (comp) comps.push(comp);
  }

  // Parsed eBay sold lines are already identity-filtered — add as extra raw comps.
  for (const line of snippets.ebaySoldLines) {
    const dash = line.lastIndexOf("—");
    if (dash < 0) continue;
    const title = line.slice(0, dash).trim();
    const priceGbp = parseGbp(line.slice(dash + 1));
    if (!priceGbp) continue;
    comps.push({
      source: "ebay",
      kind: /psa|bgs|beckett|cgc|tag|ace|graded|gem mint|slab/i.test(title) ? "graded" : "raw",
      priceGbp,
      label: title.slice(0, 140),
      company: undefined,
      grade: undefined,
    });
  }

  return compsToPricing(comps, gradedTargets, str(parsed.notes));
}
