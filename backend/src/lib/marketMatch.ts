/** Shared listing ↔ card identity matching for market comp validation. */

export interface CardMatchParts {
  name: string;
  set?: string;
  number?: string;
}

export function listingMatchesCard(
  title: string,
  parts: CardMatchParts
): boolean {
  const t = title.toLowerCase();
  const name = parts.name.trim();
  if (!name) return false;

  const nameTokens = name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (!nameTokens.length) return false;
  const hits = nameTokens.filter((w) => t.includes(w)).length;
  if (hits < Math.min(2, nameTokens.length)) return false;

  const number = parts.number?.trim();
  if (number) {
    const num = number.replace(/^0+/, "") || number;
    const numPadded = number.padStart(num.length, "0");
    const numOk =
      t.includes(number.toLowerCase()) ||
      t.includes(num) ||
      t.includes(`#${num}`) ||
      t.includes(`/${num}`) ||
      (numPadded !== num && t.includes(numPadded));
    if (!numOk) return false;
  }

  const set = parts.set?.trim();
  if (set) {
    const setLower = set.toLowerCase();
    if (setLower.length <= 3) {
      if (!t.includes(setLower)) return false;
    } else {
      const setWords = setLower.split(/\s+/).filter((w) => w.length > 2);
      const setHit =
        t.includes(setLower) ||
        (setWords.length > 0 &&
          setWords.filter((w) => t.includes(w)).length >= Math.min(2, setWords.length));
      if (!setHit) return false;
    }
  }

  if (/\b(lot|bundle|bulk|proxy|custom|reprint|playset|play set|booster box|empty box)\b/i.test(t)) {
    return false;
  }

  return true;
}

export function normalizeCompany(name: string): string {
  const n = name.toLowerCase();
  if (/beckett|bgs/.test(n)) return "beckett";
  if (/psa/.test(n)) return "psa";
  if (/cgc/.test(n)) return "cgc";
  if (/tag/.test(n)) return "tag";
  if (/ace/.test(n)) return "ace";
  return n.replace(/[^a-z]/g, "");
}

export function companyMatches(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return normalizeCompany(a) === normalizeCompany(b);
}
