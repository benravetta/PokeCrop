import type { CardIdentity, NormalisedCardIdentity } from "./types.js";

export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&pound;/gi, "£")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function normaliseText(text: string): string {
  return decodeEntities(text)
    .toLowerCase()
    .replace(/[^\w\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normaliseEdition(edition: string): string {
  const t = normaliseText(edition);
  if (/first edition|1st edition|1st ed/.test(t)) return "first edition";
  if (/shadowless/.test(t)) return "shadowless";
  if (/unlimited/.test(t)) return "unlimited";
  return t;
}

export function normaliseFinish(finish: string): string {
  const t = normaliseText(finish);
  if (/reverse holo|reverse holographic|rev holo/.test(t)) return "reverse holo";
  if (/non holo|non-holo|nonholo/.test(t)) return "non holo";
  if (/\bholo\b|holofoil|holographic/.test(t)) return "holo";
  return t;
}

export function normaliseGrader(grader: string): string {
  const t = normaliseText(grader);
  if (/beckett|bgs/.test(t)) return "bgs";
  if (/psa/.test(t)) return "psa";
  if (/cgc/.test(t)) return "cgc";
  if (/tag/.test(t)) return "tag";
  if (/ace/.test(t)) return "ace";
  if (/sgc/.test(t)) return "sgc";
  return t.replace(/\s+/g, " ");
}

export function parseCardNumberParts(cardNumber: string): { num: string; total: string } {
  const raw = cardNumber.trim();
  const m = raw.match(/(\d+)\s*[/\-\s]\s*(\d+)/);
  if (m) return { num: m[1]!.replace(/^0+/, "") || m[1]!, total: m[2]! };
  const digits = raw.replace(/[^\d]/g, "");
  return { num: digits.replace(/^0+/, "") || digits, total: "" };
}

export function cardNumberVariants(cardNumber: string): string[] {
  const { num, total } = parseCardNumberParts(cardNumber);
  const variants = new Set<string>();
  if (num) {
    variants.add(num);
    variants.add(num.padStart(3, "0"));
    if (total) {
      variants.add(`${num}/${total}`);
      variants.add(`${num} ${total}`);
      variants.add(`${num}-${total}`);
      variants.add(`${num.padStart(3, "0")}/${total}`);
    }
  }
  return [...variants].map((v) => v.toLowerCase());
}

function slug(s: string): string {
  return normaliseText(s).replace(/\s+/g, "-");
}

export function buildCacheKey(card: CardIdentity): string {
  return [
    slug(card.game ?? "pokemon"),
    slug(card.cardName),
    slug(card.setName ?? ""),
    slug(card.cardNumber ?? "").replace(/\//g, "-"),
    card.year ? String(card.year) : "",
    slug(normaliseEdition(card.edition ?? "")),
    slug(normaliseFinish(card.finish ?? card.variant ?? "")),
    slug(card.language ?? "english"),
    card.conditionType,
    slug(normaliseGrader(card.grader ?? "")),
    slug(card.grade ?? ""),
  ]
    .filter(Boolean)
    .join("|");
}

export function normaliseCardIdentity(card: CardIdentity): NormalisedCardIdentity {
  const cardNumber = (card.cardNumber ?? "").trim();
  return {
    ...card,
    game: card.game ?? "Pokemon",
    language: card.language ?? "English",
    normalised: {
      game: normaliseText(card.game ?? "Pokemon"),
      cardName: normaliseText(card.cardName),
      setName: normaliseText(card.setName ?? ""),
      cardNumber: normaliseText(cardNumber),
      cardNumberParts: parseCardNumberParts(cardNumber),
      edition: normaliseEdition(card.edition ?? ""),
      variant: normaliseText(card.variant ?? ""),
      finish: normaliseFinish(card.finish ?? card.variant ?? ""),
      language: normaliseText(card.language ?? "english"),
      grader: normaliseGrader(card.grader ?? ""),
      grade: normaliseText(card.grade ?? "").replace(/[^\d.]/g, ""),
    },
    cacheKey: buildCacheKey(card),
  };
}

export function hasMinimumIdentity(card: CardIdentity): boolean {
  if (!card.cardName?.trim()) return false;
  return Boolean(card.setName?.trim() || card.cardNumber?.trim());
}

/** Map GemCheck grade inspection identity to sold lookup input. */
export function cardIdentityFromGradeFields(fields: Record<string, unknown>): CardIdentity | null {
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  if (!name) return null;
  const setName = typeof fields.set === "string" ? fields.set.trim() : undefined;
  const numberRaw = typeof fields.number === "string" ? fields.number.trim() : "";
  const setTotal = typeof fields.set_total === "string" ? fields.set_total.trim() : "";
  const cardNumber =
    numberRaw && setTotal && !numberRaw.includes("/")
      ? `${numberRaw}/${setTotal}`
      : numberRaw || undefined;

  const variant = typeof fields.variant === "string" ? fields.variant : null;
  const edition = typeof fields.edition === "string" ? fields.edition : undefined;
  const language = typeof fields.language === "string" ? fields.language : "English";

  let finish: string | null = null;
  if (variant) {
    if (/reverse/i.test(variant)) finish = "Reverse Holo";
    else if (/holo/i.test(variant)) finish = "Holo";
    else if (/non/i.test(variant)) finish = "Non-holo";
  }

  return {
    game: "Pokemon",
    cardName: name,
    setName,
    cardNumber,
    edition,
    variant,
    finish,
    language,
    conditionType: "raw",
    grader: null,
    grade: null,
    currency: "GBP",
  };
}

export function gradedIdentityFromRaw(
  raw: CardIdentity,
  grader: string,
  grade: string
): CardIdentity {
  return {
    ...raw,
    conditionType: "graded",
    grader,
    grade,
  };
}
