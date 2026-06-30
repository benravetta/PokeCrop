import type { CardIdentity } from "./types.js";

function part(v: string | null | undefined): string {
  return (v ?? "").trim();
}

function compact(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

function dehash(v: string): string {
  return v.replace(/^#/, "");
}

export function generateSearchAliases(card: CardIdentity): string[] {
  const game = part(card.game) || "Pokemon";
  const name = part(card.cardName);
  const set = part(card.setName);
  const num = dehash(part(card.cardNumber));
  const edition = part(card.edition);
  const finish = part(card.finish || card.variant || "");
  const language = part(card.language);
  const grader = part(card.grader ?? undefined);
  const grade = part(card.grade ?? undefined);

  const aliases = new Set<string>();
  const add = (...bits: string[]) => {
    const q = compact(bits.filter(Boolean).join(" "));
    if (q.length >= 4) aliases.add(q);
  };

  add(game, name, num, set, edition, finish, language, grader, grade);
  add(name, num, set, edition, finish);
  add(name, "Promo", num);
  add(name, "Promo", `#${num}`);
  add(name, set, num);
  add(name, num, finish);
  add(name, "Movie Promo", num);
  add(name, "WB Promo", num);
  add(name, "Kids WB Promo", num);
  add(name, num, language);
  add(game, name, num);
  add(name, num);

  // common shorthand
  if (set.toLowerCase().includes("first movie")) {
    add(name, "First Movie Promo", num);
    add(name, "Pokemon Movie Promo", num);
  }
  if (set.toLowerCase().includes("base set")) {
    add(name, "Base", num);
  }
  if (edition.toLowerCase().includes("1st")) {
    add(name, num, "1st Edition");
  }

  // graded variants
  if (card.conditionType === "raw") {
    add(name, num, "raw");
    add(name, num, "ungraded");
    for (const g of ["PSA", "BGS", "CGC", "TAG", "ACE"]) {
      add(name, num, g);
    }
  } else {
    add(name, num, grader, grade);
  }

  return Array.from(aliases).slice(0, 30);
}
