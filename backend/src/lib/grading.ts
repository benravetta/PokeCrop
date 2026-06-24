import { chatComplete, isOpenAiConfigured, type ChatImage } from "./openai.js";
import { buildPreparation } from "./preparation.js";
import { estimateMarketPrices } from "./marketPricing.js";
import { scoreGrades } from "./gradeScoring.js";

// Strict, anti-hype PSA-style pre-grader. Two passes:
//   1) inspection — vision model reports structured condition findings, no grade
//   2) adjudication — text model applies hard caps and assigns a grade range
// Splitting these stops the model from "scratches visible, likely PSA 10" logic.
const INSPECT_MODEL = process.env.CARD_GRADE_INSPECT_MODEL || "gpt-4o";
const ADJUDICATE_MODEL = process.env.CARD_GRADE_ADJUDICATE_MODEL || "gpt-4o-mini";

export function isGradingConfigured(): boolean {
  return isOpenAiConfigured();
}

export interface GradeImageInput {
  label: "front" | "back" | "angled_front" | "angled_back" | "closeup";
  dataUrl: string;
}

// Exact centering ratios measured client-side on the straightened card
// (e.g. "55/45"). When supplied they are treated as ground truth and override
// the model's eyeball estimate.
export interface MeasuredCentering {
  front?: { leftRight?: string; topBottom?: string };
  back?: { leftRight?: string; topBottom?: string };
}

const INSPECT_SYSTEM =
  "You are GemCheck AI Pre-Grader, a strict Pokémon/TCG card pre-grading " +
  "inspector. You report only what is visible. You do NOT assign a final grade " +
  "in this step. Be strict: most raw cards are not PSA 10 candidates. Never " +
  "invent defects and never ignore visible ones. If photo quality hides detail, " +
  "say so and lower the relevant confidence. Output ONLY a strict JSON object.";

const INSPECT_PROMPT = `Inspect the supplied card image(s) and return ONLY this JSON shape:
{
  "is_trading_card": true,
  "not_card_reason": "",
  "card_identification": { "name": "", "set": "", "number": "", "set_total": "", "rarity": "", "variant": "", "edition": "", "holo_type": "", "language": "", "regulation_mark": "", "illustrator": "", "identifiers": [], "confidence": "low|medium|high" },
  "image_suitability": { "rating": "excellent|good|limited|poor", "limitations": [] },
  "views_present": { "front": true, "back": false, "angled": false, "closeups": false },
  "structural_damage": [ { "type": "tear|rip|hole|missing_piece|paper_loss|crease|fold|bend|indentation|water_damage|tape|adhesive|stain|writing|trimmed|altered", "where": "", "severity": "minor|moderate|major", "confidence": "low|medium|high" } ],
  "centering": { "front_left_right": "", "front_top_bottom": "", "back_left_right": "", "back_top_bottom": "", "verdict": "", "psa10_compatible": true },
  "corners": { "front_top_left": "", "front_top_right": "", "front_bottom_left": "", "front_bottom_right": "", "back_top_left": "", "back_top_right": "", "back_bottom_left": "", "back_bottom_right": "", "score": 0, "verdict": "" },
  "edges": { "findings": [], "score": 0, "verdict": "" },
  "surface": { "findings": [], "score": 0, "verdict": "" },
  "eye_appeal": { "findings": [], "score": 0 },
  "defects": [ { "kind": "dust|fingerprint|surface_residue|foil_scrape|surface_scratch|holo_scratch|print_line|gloss_loss|edge_whitening|corner_whitening|indentation|scuff|stain|crease|bend|tear|hole|writing|tape", "side": "front|back", "region": "top_left_corner|top_right_corner|bottom_left_corner|bottom_right_corner|top_edge|bottom_edge|left_edge|right_edge|top_left|top_center|top_right|center_left|center|center_right|bottom_left|bottom_center|bottom_right|holo_area|full", "bbox": [0,0,0,0], "severity": "minor|moderate|major", "note": "" } ],
  "observations": [ { "issue": "", "where": "", "severity": "minor|moderate|major", "likely": "damage|factory|unsure" } ]
}
Rules: FIRST decide whether the image actually shows a trading card (Pokémon, other TCG, or sports card). If it clearly does NOT — e.g. a person, animal, landscape, food, screenshot, document, blank page, or some random object — set "is_trading_card": false, give a short "not_card_reason" (what it looks like instead), and you may leave the remaining condition fields at their defaults. Only set "is_trading_card": true when a card is genuinely present. A sealed pack, a sleeved/slabbed card, or a card photographed at an angle still counts as a card. each corner gets "Clean", "Minor concern", "Moderate concern", "Major concern", or "Cannot assess". ALWAYS fill corners.score, edges.score, surface.score and eye_appeal.score with a number 0-10 (one decimal is fine) — never leave one blank. Calibrate every axis the same way: 10 = flawless under a loupe; 9 = one tiny flaw only a grader would catch; 8 = a few minor flaws; 7 = clearly visible wear; 5-6 = heavy/obvious wear; 3-4 = major damage; 0-2 = destroyed/structural break. Reserve 0 for a destroyed axis, NOT as a default — a clean-looking card should score high. Deduct for every visible defect and deduct again (and lower confidence) when photo quality limits inspection. Separate likely physical damage from likely factory print defects in observations. For holo/textured/full-art cards, note that surface confidence is limited without an angled-light image. Centering tolerance: PSA 10 front <= ~55/45, back <= ~75/25.

STRUCTURAL DAMAGE IS THE MOST IMPORTANT THING TO REPORT. Before anything else, look at the whole outline and surface for any break in the card itself:
- A tear, rip, split, hole, missing piece, or paper loss is catastrophic — if you see the card edge or body broken, torn, notched, or a chunk missing, you MUST add a structural_damage entry with the matching type and severity "major". Never describe this as mere "edge wear".
- Also report creases/folds (a full bend-line through the stock), bends, indentations, water damage/staining, tape or adhesive residue, and any writing.
- If none is visible, return an empty structural_damage array — but only after actually checking the full outline.

Inspect for and report each of these wherever visible:
- Corners: whitening, softness, rounding, chipping, fraying, bends, corner lift, dents, crushing, peeling.
- Edges: whitening, chipping, silvering, rough or uneven cut, nicks, dents, lifted foil, edge wear, dark damage, AND any tear/split/missing material.
- Surface: scratches, holo scratches, print lines, roller lines, dents, indentations, stains, fingerprints, scuffs, gloss loss, clouding, pressure marks, bends, creases, texture damage, ink spots, whitening on dark areas, and factory print defects.
Do not invent defects, but do not skip a category — if a region cannot be judged, mark it "Cannot assess" rather than "Clean".

"defects" — for EVERY individual flaw you can actually see (skip factory print defects unless damaging), add one entry so it can be located on the card:
- "kind": closest match from the list. Use the structural kinds (crease/tear/hole/writing/tape) only when truly present.
- "side": which photo it is on.
- "region": the single named zone it sits in. Corners and edges use the corner/edge names; surface flaws use the 3x3 grid (top_left..bottom_right) or "holo_area"; use "full" only for something spanning the whole card.
- "bbox": a TIGHT normalised box [x, y, width, height] with values 0-1 measured from the top-left of THAT image, enclosing just the flaw. If you cannot localise it precisely, return [0,0,0,0] and rely on "region".
- "severity": minor (faint/tiny), moderate (clearly visible), major (severe/structural).
Only include flaws you are reasonably confident are real and physical. An empty array is fine for a clean card.

IDENTIFICATION — read the printed card carefully and fill card_identification ACCURATELY; never invent. Leave a field empty/"unknown" if it is not legible rather than guessing:
- name: the card's printed name exactly as shown.
- number / set_total: the collector number printed on the card, usually bottom-left/bottom-right (e.g. "025/203" -> number "025", set_total "203"; promos read like "SWSH039" or "XY12"). Strip nothing meaningful; keep leading zeros as printed.
- set: the set name or symbol if identifiable (read the set symbol/era); else leave empty.
- rarity: e.g. Common, Uncommon, Rare, Holo Rare, Double Rare, Illustration Rare, Special Illustration Rare, Secret Rare, Promo — infer from the rarity symbol and treatment.
- variant: e.g. "Holofoil", "Reverse Holo", "Non-holo", "Full Art", "Alt Art", "Gold", "Jumbo".
- holo_type: the foil pattern if visible (e.g. cosmos, cracked-ice, etched), else empty.
- edition: read edition/printing marks EXACTLY — "1st Edition" (the 1st Edition stamp, for Pokémon a black circular stamp at the lower-left of the artwork window), "Shadowless", "Unlimited", or empty if none/cannot tell. Do not claim 1st Edition unless the stamp is actually visible.
- regulation_mark: the small letter (e.g. D, E, F, G, H) near the bottom-left on modern Pokémon, if present.
- illustrator: the "Illus./Illustrator" credit if legible.
- language: the card's language (English, Japanese, etc.).
- identifiers: a list of any OTHER distinguishing printed marks or stamps you can see — promo/event stamps (e.g. a gold "POKÉMON" stamp, Prerelease, Staff, Pokémon League, World Championship), set symbols, error/misprint indicators, grading-relevant stamps. Each as a short string. Empty list if none.
- confidence: low/medium/high for the identification overall.

MARKET PRICING DEPENDENCY — after this report, automated comp lookups search Cardmarket, PriceCharting and eBay using name + set + number (+ variant). Wrong IDs mean wrong prices:
- name must be the official printed card name exactly (no nicknames or fan names). For non-English cards, use the printed name if legible; otherwise leave empty and set confidence low.
- number must be read from the card (including leading zeros). Never infer a number from artwork or memory.
- set must be the collector-facing English set name people search (e.g. "Scarlet & Violet 151", "Paldea Evolved"), not just an era code.
- variant must distinguish Holofoil, Reverse Holo, Non-holo, Full Art, Alt Art, Promo, etc. — prices differ sharply.
- If you cannot read the name AND (set OR number) confidently, set confidence to low even when you recognise the artwork.`;

const ADJUDICATE_SYSTEM =
  "You are the final grading adjudicator for GemCheck. You are given structured " +
  "condition findings from a vision inspection. Do NOT inspect any image. Use " +
  "ONLY the findings. Apply hard caps BEFORE estimating any grade. Be " +
  "conservative and anti-hype: never output a single certain grade — always a " +
  "range per company and a top-grade likelihood. You estimate across multiple " +
  "grading companies (PSA, Beckett/BGS, CGC, TAG, ACE), each with its own scale. " +
  "Output ONLY a strict JSON object.";

const ADJUDICATE_PROMPT = `Given the inspection findings, return ONLY this JSON shape:
{
  "authentic": { "is_authentic_only": false, "reason": "" },
  "hard_grade_caps": [ { "cap": "", "reason": "" } ],
  "grade_blockers": { "gem_mint": [], "mint": [], "near_mint": [] },
  "company_estimates": [
    { "company": "PSA", "scale": "", "low": "", "likely": "", "high": "", "top_grade_likelihood": "high|medium|low|very_low|cannot_assess", "subgrades": null },
    { "company": "Beckett (BGS)", "scale": "", "low": "", "likely": "", "high": "", "top_grade_likelihood": "high|medium|low|very_low|cannot_assess", "subgrades": { "centering": "", "corners": "", "edges": "", "surface": "" } },
    { "company": "CGC", "scale": "", "low": "", "likely": "", "high": "", "top_grade_likelihood": "high|medium|low|very_low|cannot_assess", "subgrades": { "centering": "", "corners": "", "edges": "", "surface": "" } },
    { "company": "TAG", "scale": "", "low": "", "likely": "", "high": "", "top_grade_likelihood": "high|medium|low|very_low|cannot_assess", "subgrades": { "centering": "", "corners": "", "edges": "", "surface": "" } },
    { "company": "ACE", "scale": "", "low": "", "likely": "", "high": "", "top_grade_likelihood": "high|medium|low|very_low|cannot_assess", "subgrades": { "centering": "", "corners": "", "edges": "", "surface": "" } }
  ],
  "submission_recommendation": { "verdict": "strong_candidate|possible_candidate_inspect_first|only_if_value_justifies|sell_raw|do_not_grade|needs_better_photos", "best_for": "", "reason": "" },
  "confidence": { "rating": "high|medium|low", "improve_with": [] },
  "summary": ""
}

Company scales — map the SAME condition onto each scale; do not invent different defects per company:
- PSA: whole numbers 1-10, top grade "Gem Mint 10". No subgrades (use null). Strictest on centering (PSA 10 front <= ~55/45) and surface. Write grades as "PSA N".
- Beckett (BGS): 0.5 steps 1-10, four subgrades (centering/corners/edges/surface) in 0.5 steps. Final ~ the weighted blend, usually held down by the lowest subgrade. "Black Label" needs all four subgrades = 10; Pristine 10 needs subgrades 9.5/10 with a blended 10. Write "BGS 8.5" and subgrades like "8.5". (Black Label / Pristine tiers are computed deterministically from subgrades — do not invent them in JSON.)
- CGC: 0.5 steps 1-10, top grade "Pristine 10" (perfect under magnification) then "Gem Mint 10". Provide subgrades in 0.5 steps. Write "CGC 9".
- TAG: one-decimal 1-10 from a computer-vision point system (e.g. "TAG 8.7"); subgrades to one decimal. Very granular, generally aligns with or slightly stricter than PSA. 
- ACE: one-decimal 1-10 AI grader with decimal subgrades (e.g. "ACE 8.6"). Provide subgrades to one decimal.

Hard caps (apply to ALL companies, on each company's scale). The MOST SEVERE applicable cap is binding:
- STRUCTURAL DAMAGE OVERRIDES EVERYTHING. Any tear, rip, split, hole, missing piece, or paper loss in structural_damage means the card CANNOT receive a numeric mint grade — cap the likely grade at the "1-2" tier (low="1", high no more than "2"). A torn or ripped card is NEVER a 7. If material is actually missing, or the card is trimmed/altered, set authentic.is_authentic_only=true, write every company's likely/high/low as "Authentic / Altered", and set every top_grade_likelihood to "very_low".
- Major crease or fold (a full break in the stock, usually visible on both sides) -> cap around "5"; two or more creases -> "3-4".
- Writing (pen/pencil) -> "1-3". Tape, adhesive, or sticker residue -> "1-4". Stain or water damage -> "1-4".
- Bend, indentation, or pressure mark with NO break in the stock -> cap around "7-8" by severity. A minor surface-only wrinkle (top layer only) -> at most "6".
- Multiple surface or holo scratches -> "8" or lower; a single light scratch -> "9" or lower.
- Visible whitening on multiple corners or edges -> "8" or lower; never a gem grade.
- One tiny corner/edge flaw, otherwise clean -> "9" tier (or one subgrade of 9 for BGS/CGC/TAG/ACE).
- Centering (worst axis sets the ceiling). Front: <=55/45 allows 10; <=60/40 allows 9; <=65/35 allows 8; <=70/30 allows 7; worse -> 6 or lower. Back is more lenient: 10 allows up to 75/25. If the findings include a "measured_centering" object, TREAT IT AS GROUND TRUTH and apply these centering caps to the measured numbers; do not second-guess them.
- Back image missing -> confidence Low, top-grade likelihood not "high", never "strong_candidate".
- Card in sleeve/toploader/slab so surface cannot be assessed, or poor image quality -> confidence Low and widen every range.

Weighting and consistency:
- Weight structural integrity first (a damaged card cannot be mint), then surface and corners, then centering and edges, then eye appeal.
- For each company: low = worst plausible, likely = most probable, high = best plausible, and low <= likely <= high on that company's scale. "likely" must respect every hard cap.
- grade_blockers: gem_mint = what blocks the top gem grade on a strict grader (≈ PSA 10 / BGS 9.5+ / CGC Pristine), mint = what blocks a ~9, near_mint = what blocks a ~8. If a tier has no visible blocker, say so but note it is limited by photo quality.
- submission_recommendation.best_for = which grader makes most sense and why (e.g. BGS/ACE/TAG when subgrades add value or the card is borderline; PSA for resale liquidity on a clean gem candidate; "none — sell raw" when grading isn't worth it). For a torn/ripped/altered card, recommend "do_not_grade".
- Never inflate any grade due to card value or rarity.`;

// Loosely-typed structured result; the model returns the shapes above.
export type GradeResult = Record<string, unknown>;

function safeParse(content: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(content);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Build a flipped "wider/narrower" ratio string for display, plus a note for
// the model. Input like "55/45" is already in larger/smaller order.
function centeringNote(c?: MeasuredCentering): string | null {
  if (!c) return null;
  const parts: string[] = [];
  if (c.front?.leftRight) parts.push(`front left/right ${c.front.leftRight}`);
  if (c.front?.topBottom) parts.push(`front top/bottom ${c.front.topBottom}`);
  if (c.back?.leftRight) parts.push(`back left/right ${c.back.leftRight}`);
  if (c.back?.topBottom) parts.push(`back top/bottom ${c.back.topBottom}`);
  return parts.length ? parts.join(", ") : null;
}

export async function gradeCard(
  images: GradeImageInput[],
  userId: string,
  measuredCentering?: MeasuredCentering
): Promise<GradeResult | null> {
  if (!isOpenAiConfigured() || images.length === 0) return null;

  const visionImages: ChatImage[] = images.map((i) => ({
    dataUrl: i.dataUrl,
    detail: "high",
  }));
  const present = {
    front: images.some((i) => i.label === "front"),
    back: images.some((i) => i.label === "back"),
    angled: images.some((i) => i.label === "angled_front" || i.label === "angled_back"),
    closeups: images.some((i) => i.label === "closeup"),
  };

  const cNote = centeringNote(measuredCentering);
  const cInstruction = cNote
    ? `\nMEASURED CENTERING (ground truth, measured on the straightened card — do NOT re-estimate these, just copy them into the centering fields): ${cNote}.`
    : "";

  // Pass 1: inspection.
  const inspect = await chatComplete({
    model: INSPECT_MODEL,
    system: INSPECT_SYSTEM,
    user:
      INSPECT_PROMPT +
      `\nViews supplied: ${JSON.stringify(present)}. Images are provided in this order: ${images
        .map((i) => i.label)
        .join(", ")}.` +
      cInstruction,
    images: visionImages,
    jsonObject: true,
    maxTokens: 1500,
    feature: "grade_inspect",
    userId,
    timeoutMs: 60000,
  });
  if (!inspect) return null;
  const findings = safeParse(inspect.content);
  if (!findings) return null;

  // Gate: if the upload obviously isn't a trading card, stop here. We skip the
  // adjudication, scoring and pricing calls (cheaper) and return a clear signal
  // so the UI explains the problem instead of inventing a grade for a non-card.
  if (findings.is_trading_card === false) {
    const reason =
      typeof findings.not_card_reason === "string" && findings.not_card_reason.trim()
        ? findings.not_card_reason.trim()
        : "This image doesn't appear to show a trading card.";
    return {
      not_a_card: true,
      reason,
      image_suitability: findings.image_suitability,
      disclaimer:
        "We couldn't find a trading card in this photo, so there's nothing to grade. " +
        "Upload a clear, square-on photo of the card's front (and back).",
    };
  }

  // Overlay the measured centering as ground truth so the adjudicator's
  // centering caps run on real numbers, and the UI can flag it as measured.
  if (measuredCentering) {
    const existing =
      findings.centering && typeof findings.centering === "object"
        ? (findings.centering as Record<string, unknown>)
        : {};
    const c: Record<string, unknown> = { ...existing, measured: true };
    if (measuredCentering.front?.leftRight) c.front_left_right = measuredCentering.front.leftRight;
    if (measuredCentering.front?.topBottom) c.front_top_bottom = measuredCentering.front.topBottom;
    if (measuredCentering.back?.leftRight) c.back_left_right = measuredCentering.back.leftRight;
    if (measuredCentering.back?.topBottom) c.back_top_bottom = measuredCentering.back.topBottom;
    findings.centering = c;
    (findings as Record<string, unknown>).measured_centering = measuredCentering;
  }

  // Pass 2: adjudication (text-only).
  const adjudicate = await chatComplete({
    model: ADJUDICATE_MODEL,
    system: ADJUDICATE_SYSTEM,
    user: `${ADJUDICATE_PROMPT}\n\nINSPECTION FINDINGS:\n${JSON.stringify(findings)}`,
    jsonObject: true,
    maxTokens: 1800,
    feature: "grade_adjudicate",
    userId,
    timeoutMs: 45000,
  });
  const decision = adjudicate ? safeParse(adjudicate.content) : null;

  // Deterministic scoring. The vision pass perceives condition and the text pass
  // writes the reasoning, but the headline NUMBERS (subgrades + final grade per
  // company) are computed here from the axis scores, measured centering and the
  // structural caps so they are internally consistent and can never contradict
  // the findings (e.g. a torn card is forced to "Authentic / Altered"). This
  // also means a grade is still produced even if the adjudication call failed.
  const scored = scoreGrades(findings as Record<string, unknown>);
  const base: Record<string, unknown> = decision ?? {};

  // Always surface the detected structural/condition caps, merged ahead of any
  // the adjudicator described.
  const llmCaps = Array.isArray(base.hard_grade_caps) ? base.hard_grade_caps : [];
  const detCap: { cap: string; reason: string }[] = [];
  if (scored.caps.authenticOnly) {
    detCap.push({
      cap: "Authentic / Altered",
      reason: scored.caps.reasons.join("; ") || "Structural damage or alteration detected.",
    });
  } else if (scored.caps.overallCap != null) {
    detCap.push({
      cap: `Capped around ${scored.caps.overallCap}`,
      reason: scored.caps.reasons.join("; "),
    });
  }

  const mergedDecision: Record<string, unknown> = {
    ...base,
    company_estimates: scored.company_estimates,
    hard_grade_caps: [...detCap, ...llmCaps],
  };

  const bgsEstimate = scored.company_estimates.find((c) => c.company === "Beckett (BGS)");
  const bgsTier = bgsEstimate?.bgs_tier;
  if (bgsTier && !scored.caps.authenticOnly) {
    const tierLabel = bgsTier === "black_label" ? "Black Label" : "Pristine 10";
    const tierDetail =
      bgsTier === "black_label"
        ? "All four BGS subgrades read at 10 — Black Label territory if surface confirms under magnification."
        : "All BGS subgrades read at 9.5 or better with a blended 10 — Pristine 10 territory on Beckett.";
    mergedDecision.bgs_insight = {
      tier: bgsTier,
      label: tierLabel,
      detail: tierDetail,
    };
  }

  if (scored.caps.authenticOnly) {
    const existingAuth =
      base.authentic && typeof base.authentic === "object"
        ? (base.authentic as Record<string, unknown>)
        : {};
    mergedDecision.authentic = {
      is_authentic_only: true,
      reason:
        (typeof existingAuth.reason === "string" && existingAuth.reason) ||
        scored.caps.reasons.join("; ") ||
        "Structural damage or alteration was detected (e.g. a tear, missing piece, or trimming). This card cannot receive a numeric mint grade.",
    };
    const existingRec =
      base.submission_recommendation && typeof base.submission_recommendation === "object"
        ? (base.submission_recommendation as Record<string, unknown>)
        : {};
    mergedDecision.submission_recommendation = {
      ...existingRec,
      verdict: "do_not_grade",
      best_for: "none — not gradeable as mint",
      reason:
        (typeof existingRec.reason === "string" && existingRec.reason) ||
        "Structural damage means a numeric grade isn't possible; it would come back as an Authentic / Altered label.",
    };
  }

  // Rough AI value estimate (raw + graded, GBP). Depends on the final company
  // estimates, so it runs last. Wrapped + time-boxed so a slow or failed pricing
  // call never fails or noticeably delays the grade — on any problem we simply
  // omit the pricing field.
  let pricing = null;
  try {
    const identity = (findings as Record<string, unknown>).card_identification;
    if (identity && typeof identity === "object") {
      pricing = await estimateMarketPrices(
        identity as Record<string, unknown>,
        scored.company_estimates,
        userId,
        { timeoutMs: 65000 }
      );
    }
  } catch {
    pricing = null;
  }

  const pricingDisclaimer = pricing
    ? "Not an official grade from PSA, Beckett, CGC, TAG, ACE or any grader. " +
      "Values are the average of verified eBay UK sold listings for this exact card — not guaranteed sale prices. Postage excluded."
    : "Not an official grade from PSA, Beckett, CGC, TAG, ACE or any grader. " +
      "No verified eBay sold comps were found for this exact card — value estimate omitted.";

  return {
    ...findings,
    ...mergedDecision,
    preparation: buildPreparation((findings as Record<string, unknown>).defects),
    ...(pricing ? { pricing } : {}),
    disclaimer:
      pricingDisclaimer +
      " Pre-check from photos only — helps you decide whether to submit or sell raw.",
  };
}
