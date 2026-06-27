import { chatComplete, isOpenAiConfigured } from "./openai.js";

const MODEL = process.env.CARD_ID_MODEL || "gpt-4o-mini";

export interface RichCardIdentification {
  name: string;
  set: string;
  set_code: string;
  number: string;
  set_total: string;
  tcg: string;
  rarity: string;
  variant: string;
  holo_type: string;
  edition: string;
  language: string;
  release_year: number | null;
  illustrator: string;
  regulation_mark: string;
  identifiers: string[];
  confidence: number | null;
}

export function isRichIdentifyConfigured(): boolean {
  return isOpenAiConfigured();
}

const SYSTEM =
  "You are an expert trading-card cataloguer. Read the card in the image and return strict JSON only. " +
  "Use empty string or null for unknown fields; never guess wildly.";

const PROMPT =
  "Identify this trading card. Return ONLY a JSON object with keys: " +
  "name, set, set_code, number, set_total, tcg, rarity, variant, holo_type, edition, language, " +
  "release_year (integer or null), illustrator, regulation_mark, identifiers (string array of stamps/marks), " +
  "confidence (0..1).\n" +
  "tcg: pokemon, one-piece, magic, yugioh, lorcana, digimon, sports, other, or unidentified.\n" +
  "set_code: printed set abbreviation lowercase when visible.\n" +
  "number: card number only (not set total).";

function str(v: unknown, max = 120): string {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : "";
}

function normalize(parsed: Record<string, unknown>): RichCardIdentification {
  let confidence: number | null = null;
  const c = parsed.confidence;
  if (typeof c === "number" && Number.isFinite(c)) {
    confidence = Math.max(0, Math.min(1, c));
  }
  const ids = Array.isArray(parsed.identifiers)
    ? parsed.identifiers.map((x) => str(x, 80)).filter(Boolean)
    : [];
  let releaseYear: number | null = null;
  if (typeof parsed.release_year === "number" && Number.isFinite(parsed.release_year)) {
    releaseYear = Math.round(parsed.release_year);
  }
  return {
    name: str(parsed.name),
    set: str(parsed.set),
    set_code: str(parsed.set_code).toLowerCase(),
    number: str(parsed.number),
    set_total: str(parsed.set_total),
    tcg: str(parsed.tcg, 40).toLowerCase() || "unidentified",
    rarity: str(parsed.rarity),
    variant: str(parsed.variant),
    holo_type: str(parsed.holo_type),
    edition: str(parsed.edition),
    language: str(parsed.language),
    release_year: releaseYear,
    illustrator: str(parsed.illustrator),
    regulation_mark: str(parsed.regulation_mark),
    identifiers: ids,
    confidence,
  };
}

export async function identifyCardRich(
  image: Buffer,
  mime = "image/jpeg"
): Promise<RichCardIdentification | null> {
  const dataUrl = `data:${mime};base64,${image.toString("base64")}`;
  const result = await chatComplete({
    model: MODEL,
    system: SYSTEM,
    user: PROMPT,
    images: [{ dataUrl, detail: "high" }],
    jsonObject: true,
    maxTokens: 400,
    feature: "collector_card_id",
    timeoutMs: 25000,
  });
  if (!result) return null;
  try {
    return normalize(JSON.parse(result.content) as Record<string, unknown>);
  } catch {
    return null;
  }
}
