import type { CardIdentity } from "./catalog.js";
import { chatComplete, isOpenAiConfigured } from "./openai.js";

// AI card identification via OpenAI's vision models. Called server-side and
// fire-and-forget, only on unique (newly de-duplicated) crops, so latency and
// cost stay bounded. A safe no-op when OpenAI is not configured.
const MODEL = process.env.CARD_ID_MODEL || "gpt-4o-mini";

export function isAiIdentifyConfigured(): boolean {
  return isOpenAiConfigured();
}

const SYSTEM =
  "You are an expert trading-card cataloguer. You read the card in the image " +
  "and return a single strict JSON object. Never guess wildly; if a field is " +
  "not legible, use its 'unknown'/'unidentified'/empty fallback.";

const PROMPT =
  "Identify this trading card. Respond with ONLY a JSON object with keys: " +
  "tcg, set, number, name, confidence.\n" +
  "- tcg: one of 'pokemon','one-piece','magic','yugioh','lorcana','digimon'," +
  "'sports','other'; use 'unidentified' if you cannot tell.\n" +
  "- set: the set code/abbreviation as printed (e.g. 'sv151','op01','mh3'), " +
  "lowercase; 'unknown' if not visible.\n" +
  "- number: the card's own collector number as printed (NOT the set total; " +
  "strip leading zeros); 'unknown' if not visible.\n" +
  "- name: the card's name; empty string if unknown.\n" +
  "- confidence: number 0..1 for your overall confidence.";

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : fallback;
}

function normalize(parsed: Record<string, unknown>): CardIdentity {
  let confidence: number | null = null;
  const c = parsed.confidence;
  if (typeof c === "number" && Number.isFinite(c)) {
    confidence = Math.max(0, Math.min(1, c));
  }
  return {
    tcg: str(parsed.tcg, "unidentified").toLowerCase(),
    set: str(parsed.set, "unknown").toLowerCase(),
    number: str(parsed.number, "unknown"),
    name: str(parsed.name, ""),
    confidence,
  };
}

export async function identifyCardAI(
  image: Buffer,
  mime = "image/jpeg"
): Promise<CardIdentity | null> {
  const dataUrl = `data:${mime};base64,${image.toString("base64")}`;
  const result = await chatComplete({
    model: MODEL,
    system: SYSTEM,
    user: PROMPT,
    images: [{ dataUrl, detail: "high" }],
    jsonObject: true,
    maxTokens: 200,
    feature: "catalog_id",
    timeoutMs: 20000,
  });
  if (!result) return null;
  try {
    return normalize(JSON.parse(result.content) as Record<string, unknown>);
  } catch {
    return null;
  }
}
