import type { CardIdentity } from "./catalog.js";

// AI card identification via OpenAI's vision models. Called server-side and
// fire-and-forget, only on unique (newly de-duplicated) crops, so latency and
// cost stay bounded. A safe no-op when OPENAI_API_KEY is not set.
const KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.CARD_ID_MODEL || "gpt-4o-mini";

export function isAiIdentifyConfigured(): boolean {
  return Boolean(KEY);
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
  const tcg = str(parsed.tcg, "unidentified").toLowerCase();
  return {
    tcg,
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
  if (!KEY) return null;
  const dataUrl = `data:${mime};base64,${image.toString("base64")}`;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error("AI identify failed:", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    return normalize(JSON.parse(content) as Record<string, unknown>);
  } catch (err) {
    console.error("AI identify error:", err);
    return null;
  }
}
