import { buildEbaySoldSearchUrl } from "./ebaySearchQueryBuilder.js";
import { detectAccessBlock, parseEbayItemHtml, parseEbaySearchHtml } from "./ebayHtmlParser.js";
import type { ListingCandidate } from "./types.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_RESPONSE_BYTES = 2_000_000;

let lastUncachedRequestAt = 0;
const MIN_DELAY_MS = Number(process.env.EBAY_SEARCH_MIN_DELAY_MS || "2500");

export interface FetchHtmlResult {
  html: string;
  status: number;
  playwrightUsed: boolean;
  url: string;
}

export interface SearchFetchResult {
  ok: boolean;
  html?: string;
  errorCode?:
    | "EBAY_ACCESS_BLOCKED"
    | "CAPTCHA_REQUIRED"
    | "SEARCH_TIMEOUT"
    | "SEARCH_RESULTS_UNAVAILABLE"
    | "PARSING_FAILED";
  message?: string;
  playwrightUsed: boolean;
  url: string;
}

async function delayUntilRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastUncachedRequestAt;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsed));
  }
  lastUncachedRequestAt = Date.now();
}

async function fetchHtmlHttp(url: string, timeoutMs: number): Promise<FetchHtmlResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_RESPONSE_BYTES) return null;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    return { html, status: res.status, playwrightUsed: false, url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtmlPlaywright(url: string, timeoutMs: number): Promise<FetchHtmlResult | null> {
  if (process.env.EBAY_SOLD_DISABLE_PLAYWRIGHT === "1") return null;
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const context = await browser.newContext({
        locale: "en-GB",
        timezoneId: "Europe/London",
        userAgent: UA,
        javaScriptEnabled: true,
      });
      const page = await context.newPage();
      await page.route("**/*", (route) => {
        const type = route.request().resourceType();
        const u = route.request().url();
        if (type === "image" || type === "media" || type === "font") {
          route.abort();
          return;
        }
        if (/doubleclick|googlesyndication|facebook\.com|analytics/i.test(u)) {
          route.abort();
          return;
        }
        route.continue();
      });
      page.setDefaultTimeout(timeoutMs);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      try {
        await page.locator(".srp-results, .s-item, #Results").first().waitFor({ timeout: 8000 });
      } catch {
        /* results container optional */
      }
      try {
        const accept = page.getByRole("button", { name: /accept|agree/i });
        if (await accept.isVisible({ timeout: 1500 })) await accept.click();
      } catch {
        /* no cookie banner */
      }
      const html = await page.content();
      await context.close();
      return { html, status: 200, playwrightUsed: true, url };
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("Playwright eBay fetch failed:", err);
    return null;
  }
}

function htmlNeedsBrowser(html: string): boolean {
  if (html.length < 5000) return true;
  if (!html.includes("s-item") && !html.includes("srp-results") && !html.includes("/itm/")) {
    return true;
  }
  return false;
}

export async function fetchEbaySearchPage(
  query: string,
  opts: { timeoutMs?: number; skipRateLimit?: boolean } = {}
): Promise<SearchFetchResult> {
  const url = buildEbaySoldSearchUrl(query);
  const timeoutMs = opts.timeoutMs ?? 25_000;
  if (!opts.skipRateLimit) await delayUntilRateLimit();

  let result = await fetchHtmlHttp(url, timeoutMs);
  if (!result || result.status >= 400) {
    result = (await fetchHtmlPlaywright(url, timeoutMs)) ?? result;
  } else if (htmlNeedsBrowser(result.html)) {
    const pw = await fetchHtmlPlaywright(url, timeoutMs);
    if (pw) result = pw;
  }

  if (!result) {
    return {
      ok: false,
      errorCode: "SEARCH_TIMEOUT",
      message: "eBay search timed out.",
      playwrightUsed: false,
      url,
    };
  }

  const block = detectAccessBlock(result.html);
  if (block) {
    return {
      ok: false,
      errorCode: block,
      message:
        block === "CAPTCHA_REQUIRED"
          ? "eBay presented a CAPTCHA challenge. No valuation has been generated."
          : "eBay temporarily prevented the sold-listing search. No valuation has been generated.",
      playwrightUsed: result.playwrightUsed,
      url,
    };
  }

  const parsed = parseEbaySearchHtml(result.html);
  if (parsed.blocked && parsed.blockReason) {
    return {
      ok: false,
      errorCode: parsed.blockReason,
      message: "eBay blocked access to sold listings.",
      playwrightUsed: result.playwrightUsed,
      url,
    };
  }

  if (!parsed.candidates.length) {
    return {
      ok: false,
      html: result.html,
      errorCode: "PARSING_FAILED",
      message: "Could not parse sold listings from eBay search page.",
      playwrightUsed: result.playwrightUsed,
      url,
    };
  }

  return {
    ok: true,
    html: result.html,
    playwrightUsed: result.playwrightUsed,
    url,
  };
}

export async function fetchEbayItemPage(
  itemUrl: string,
  opts: { timeoutMs?: number } = {}
): Promise<Partial<ListingCandidate> | null> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  await delayUntilRateLimit();
  let result = await fetchHtmlHttp(itemUrl, timeoutMs);
  if (!result || detectAccessBlock(result.html)) {
    result = (await fetchHtmlPlaywright(itemUrl, timeoutMs)) ?? result;
  }
  if (!result) return null;
  return parseEbayItemHtml(result.html) ?? null;
}

/** Test hook — reset rate limit clock. */
export function resetRateLimitForTests(): void {
  lastUncachedRequestAt = 0;
}

export function parseCandidatesFromHtml(html: string): ListingCandidate[] {
  return parseEbaySearchHtml(html).candidates;
}
