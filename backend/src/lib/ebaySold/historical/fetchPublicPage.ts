import { parsePrice, parseSoldDate } from "../ebayHtmlParser.js";
import { decodeEntities } from "../cardIdentityNormaliser.js";
import { isAllowedArchiveUrl } from "./archiveSources.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_BYTES = 1_500_000;

export async function fetchAllowlistedPage(url: string, timeoutMs = 15_000): Promise<string | null> {
  if (!isAllowedArchiveUrl(url)) return null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return null;
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
  } catch {
    return null;
  }
}

export function stripHtmlText(html: string): string {
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectArchiveBlock(html: string): boolean {
  return /captcha|access denied|verify you are a human/i.test(html);
}

export { parsePrice, parseSoldDate };
