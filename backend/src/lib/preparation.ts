// Card preparation engine.
//
// The vision model handles PERCEPTION (what defect, where, how bad). This file
// handles the PRESCRIPTION (what, if anything, can be safely done) using a
// fixed, auditable knowledge base. Keeping the prescription deterministic lets
// us hard-guarantee the safety guardrail: anything structural or anything that
// would count as card alteration is never recommended.

export type Risk = "low" | "medium" | "high";
export type Difficulty = "easy" | "moderate" | "advanced" | "n/a";

export interface Defect {
  kind: string;
  side: "front" | "back";
  region: string;
  bbox: number[] | null;
  severity: "minor" | "moderate" | "major";
  note?: string;
}

export interface PrepItem extends Defect {
  label: string; // human-readable defect name
  location: string; // human-readable region + side
  canAttempt: boolean; // safe to attempt at home?
  action: string; // short title of the recommendation
  method: string; // what to actually do (or why not)
  difficulty: Difficulty;
  risk: Risk;
  reversible: boolean;
  tools: string[];
  expectedUpside: string;
  caution?: string;
}

export interface Preparation {
  items: PrepItem[];
  safeCount: number;
  avoidCount: number;
  summary: string;
  disclaimer: string;
}

const KIND_LABELS: Record<string, string> = {
  dust: "Loose dust / debris",
  fingerprint: "Fingerprint / smudge",
  surface_residue: "Surface residue",
  foil_scrape: "Foil scrape",
  surface_scratch: "Surface scratch",
  holo_scratch: "Holo scratch",
  print_line: "Print line (factory)",
  gloss_loss: "Gloss loss",
  edge_whitening: "Edge whitening",
  corner_whitening: "Corner whitening",
  indentation: "Indentation / pressure mark",
  scuff: "Light scuff",
  stain: "Stain",
  crease: "Crease",
  bend: "Bend",
  tear: "Tear",
  hole: "Hole / missing piece",
  writing: "Writing / marking",
  tape: "Tape / adhesive",
};

const REGION_LABELS: Record<string, string> = {
  top_left_corner: "top-left corner",
  top_right_corner: "top-right corner",
  bottom_left_corner: "bottom-left corner",
  bottom_right_corner: "bottom-right corner",
  top_edge: "top edge",
  bottom_edge: "bottom edge",
  left_edge: "left edge",
  right_edge: "right edge",
  top_left: "upper-left area",
  top_center: "top-centre",
  top_right: "upper-right area",
  center_left: "centre-left",
  center: "centre",
  center_right: "centre-right",
  bottom_left: "lower-left area",
  bottom_center: "bottom-centre",
  bottom_right: "lower-right area",
  holo_area: "holo area",
  full: "across the card",
};

type Guidance = Omit<PrepItem, keyof Defect | "label" | "location">;

const DO_NOT_ATTEMPT: Guidance = {
  canAttempt: false,
  action: "Leave it — do not attempt",
  method: "",
  difficulty: "n/a",
  risk: "high",
  reversible: false,
  tools: [],
  expectedUpside: "None — any 'repair' here counts as alteration and will fail grading.",
};

// Base guidance per defect kind. Some kinds are refined by severity below.
function guidanceFor(kind: string, severity: Defect["severity"]): Guidance {
  switch (kind) {
    case "dust":
      return {
        canAttempt: true,
        action: "Remove loose dust",
        method:
          "Lift dust with a clean, dry microfibre cloth or a soft anti-static brush using light, single-direction strokes. Never press or scrub.",
        difficulty: "easy",
        risk: "low",
        reversible: true,
        tools: ["Microfibre cloth", "Soft anti-static brush"],
        expectedUpside: "Recovers the small surface deduction if dust was the only issue.",
      };
    case "fingerprint":
    case "scuff":
      return {
        canAttempt: true,
        action: "Buff away gently",
        method:
          "Buff lightly with a clean, dry microfibre cloth in small circles. Use no liquids or solvents on the printed surface.",
        difficulty: "easy",
        risk: "low",
        reversible: true,
        tools: ["Microfibre cloth"],
        expectedUpside: "Removes a common, easily-fixed surface deduction.",
      };
    case "surface_residue":
      return {
        canAttempt: true,
        action: "Clean light residue carefully",
        method:
          "Try a dry microfibre cloth first. For a stubborn spot, use a barely-damp cloth with a little distilled water on the border ONLY, then dry immediately. Keep all moisture off the artwork, foil and ink.",
        difficulty: "moderate",
        risk: "medium",
        reversible: true,
        tools: ["Microfibre cloth", "Distilled water (sparingly)"],
        expectedUpside: "Minor surface improvement if the residue lifts cleanly.",
        caution: "Moisture can lift ink or foil — stop if anything smears.",
      };
    case "indentation":
      if (severity === "minor")
        return {
          canAttempt: true,
          action: "Relax with flat storage",
          method:
            "Store the card flat under even, gentle weight (between two rigid sleeves and a flat board) for a few weeks. Faint pressure marks sometimes relax. Never use heat, moisture, or force.",
          difficulty: "advanced",
          risk: "medium",
          reversible: true,
          tools: ["Rigid sleeves", "Flat weight"],
          expectedUpside: "May soften a faint pressure mark — no guarantee.",
          caution: "Only worth trying on the faintest marks; deeper dents won't lift.",
        };
      return { ...DO_NOT_ATTEMPT, action: "Leave it — pressure mark too deep" };
    case "gloss_loss":
      return {
        ...DO_NOT_ATTEMPT,
        action: "Leave it — don't re-coat",
        method:
          "Adding gloss, sealant or coating to restore shine is alteration and is detectable. Leave the surface as-is.",
      };
    case "foil_scrape":
    case "surface_scratch":
    case "holo_scratch":
      return {
        ...DO_NOT_ATTEMPT,
        action: "Can't be safely repaired",
        method:
          "Foil and clear-coat loss can't be restored without adding material. Filling, painting or coating is alteration and will fail grading or earn an 'Altered' label. Leave it and price the card as-is.",
      };
    case "edge_whitening":
    case "corner_whitening":
      return {
        ...DO_NOT_ATTEMPT,
        action: "Don't colour or sand",
        method:
          "Re-colouring edges/corners or sanding/recutting is alteration and is easily detected. At most, remove loose fibres with a soft, dry brush — never add ink or trim.",
        tools: ["Soft brush (loose fibres only)"],
      };
    case "stain":
      return {
        ...DO_NOT_ATTEMPT,
        action: "Leave it — avoid wet cleaning",
        method:
          "Stains usually set into the stock. Aggressive or wet cleaning risks spreading it and damaging the surface. Leave it.",
      };
    case "print_line":
      return {
        ...DO_NOT_ATTEMPT,
        risk: "low",
        action: "Leave it — factory defect",
        method:
          "Print lines come from manufacturing, not handling. They can't be removed, and graders account for them. Nothing to do.",
        expectedUpside: "None needed — this is a factory characteristic.",
      };
    case "crease":
    case "bend":
    case "tear":
    case "hole":
    case "writing":
    case "tape":
      return {
        ...DO_NOT_ATTEMPT,
        action: "Do not attempt — structural / alteration",
        method:
          "Repairing structural damage (creases, tears, holes) or removing writing/tape is alteration and will fail grading or be flagged 'Altered'. For a card you're keeping, only a professional conservator should ever touch it.",
      };
    default:
      return {
        ...DO_NOT_ATTEMPT,
        action: "Leave it",
        method: "No safe at-home preparation applies to this. Leave it as-is.",
      };
  }
}

const REGIONS = new Set(Object.keys(REGION_LABELS));
const VALID_BBOX = (b: unknown): number[] | null => {
  if (!Array.isArray(b) || b.length !== 4) return null;
  const n = b.map(Number);
  if (n.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) return null;
  if (n[2] <= 0 || n[3] <= 0) return null; // zero-size means "not localised"
  return n;
};

function normaliseDefect(raw: unknown): Defect | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = typeof r.kind === "string" ? r.kind : "";
  if (!kind) return null;
  const side = r.side === "back" ? "back" : "front";
  const region = typeof r.region === "string" && REGIONS.has(r.region) ? r.region : "full";
  const severity =
    r.severity === "major" || r.severity === "moderate" ? r.severity : "minor";
  return {
    kind,
    side,
    region,
    bbox: VALID_BBOX(r.bbox),
    severity,
    note: typeof r.note === "string" ? r.note : undefined,
  };
}

export function buildPreparation(rawDefects: unknown): Preparation {
  const list = Array.isArray(rawDefects) ? rawDefects : [];
  const items: PrepItem[] = [];
  for (const raw of list.slice(0, 24)) {
    const d = normaliseDefect(raw);
    if (!d) continue;
    const g = guidanceFor(d.kind, d.severity);
    items.push({
      ...d,
      ...g,
      label: KIND_LABELS[d.kind] || d.kind.replace(/_/g, " "),
      location: `${REGION_LABELS[d.region] || d.region} (${d.side})`,
    });
  }

  const safeCount = items.filter((i) => i.canAttempt).length;
  const avoidCount = items.length - safeCount;

  let summary: string;
  if (items.length === 0) {
    summary =
      "No specific defects were located to prepare. Focus on clean, glare-free photos and proper storage before submitting.";
  } else if (safeCount === 0) {
    summary =
      "Nothing here is safe to repair at home — the visible issues are either structural or would count as alteration. Best move is to clean only with a dry microfibre cloth and submit (or sell) the card as-is.";
  } else {
    summary = `${safeCount} item${safeCount === 1 ? "" : "s"} can be safely prepped at home${
      avoidCount ? `, and ${avoidCount} should be left alone` : ""
    }. Do the safe prep, photograph again, then decide on submitting.`;
  }

  return {
    items,
    safeCount,
    avoidCount,
    summary,
    disclaimer:
      "Preparation guidance only. Cleaning is at your own risk and can damage a card. " +
      "Never attempt to repair structural damage or alter a card you intend to grade — " +
      "alteration (filling, colouring, trimming, re-gloss) fails grading and can be flagged.",
  };
}
