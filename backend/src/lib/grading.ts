import { chatComplete, isOpenAiConfigured, type ChatImage } from "./openai.js";

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

const INSPECT_SYSTEM =
  "You are CardCrop AI Pre-Grader, a strict Pokémon/TCG card pre-grading " +
  "inspector. You report only what is visible. You do NOT assign a final grade " +
  "in this step. Be strict: most raw cards are not PSA 10 candidates. Never " +
  "invent defects and never ignore visible ones. If photo quality hides detail, " +
  "say so and lower the relevant confidence. Output ONLY a strict JSON object.";

const INSPECT_PROMPT = `Inspect the supplied card image(s) and return ONLY this JSON shape:
{
  "card_identification": { "name": "", "set": "", "number": "", "variant": "", "language": "", "confidence": "low|medium|high" },
  "image_suitability": { "rating": "excellent|good|limited|poor", "limitations": [] },
  "views_present": { "front": true, "back": false, "angled": false, "closeups": false },
  "centering": { "front_left_right": "", "front_top_bottom": "", "back_left_right": "", "back_top_bottom": "", "verdict": "", "psa10_compatible": true },
  "corners": { "front_top_left": "", "front_top_right": "", "front_bottom_left": "", "front_bottom_right": "", "back_top_left": "", "back_top_right": "", "back_bottom_left": "", "back_bottom_right": "", "score": 0, "verdict": "" },
  "edges": { "findings": [], "score": 0, "verdict": "" },
  "surface": { "findings": [], "score": 0, "verdict": "" },
  "eye_appeal": { "findings": [], "score": 0 },
  "observations": [ { "issue": "", "where": "", "severity": "minor|moderate|major", "likely": "damage|factory|unsure" } ]
}
Rules: each corner gets "Clean", "Minor concern", "Moderate concern", "Major concern", or "Cannot assess". Scores are 0-10. Separate likely physical damage from likely factory print defects in observations. For holo/textured/full-art cards, note that surface confidence is limited without an angled-light image. Centering tolerance: PSA 10 front <= ~55/45, back <= ~75/25.`;

const ADJUDICATE_SYSTEM =
  "You are the final grading adjudicator for CardCrop. You are given structured " +
  "condition findings from a vision inspection. Do NOT inspect any image. Use " +
  "ONLY the findings. Apply hard caps BEFORE estimating a grade. Be conservative " +
  "and anti-hype: never output a single certain grade — always a range and a " +
  "PSA 10 likelihood. Output ONLY a strict JSON object.";

const ADJUDICATE_PROMPT = `Given the inspection findings, return ONLY this JSON shape:
{
  "hard_grade_caps": [ { "cap": "", "reason": "" } ],
  "grade_blockers": { "psa10": [], "psa9": [], "psa8": [] },
  "estimated_grade_range": { "optimistic": "", "realistic": "", "conservative": "", "most_likely": "", "psa10_likelihood": "high|medium|low|very_low|cannot_assess" },
  "submission_recommendation": { "verdict": "strong_psa_candidate|possible_candidate_inspect_first|only_if_value_justifies|sell_raw|do_not_grade|needs_better_photos", "reason": "" },
  "confidence": { "rating": "high|medium|low", "improve_with": [] },
  "summary": ""
}
Hard caps to apply:
- Clear crease/bend/dent/indentation/stain/water damage/peeling/structural damage -> cap at PSA 7 or lower by severity.
- Multiple surface or holo scratches -> cap at PSA 8 or lower.
- Visible whitening on multiple back corners/edges -> cap at PSA 8; never call PSA 10.
- One tiny corner/edge flaw, otherwise clean -> cap at PSA 9.
- Front centering worse than ~55/45 -> cap at PSA 9; ~65/35 or worse -> PSA 8 or lower.
- Back image missing -> confidence Low, PSA 10 likelihood cannot be high, never "strong" candidate.
- Card in sleeve/toploader/slab so surface cannot be assessed, or poor image quality -> confidence Low.
List every cap you apply. If a category has no visible blocker, say so but note it is limited by photo quality. Never inflate a grade due to card value or rarity.`;

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

export async function gradeCard(
  images: GradeImageInput[],
  userId: string
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

  // Pass 1: inspection.
  const inspect = await chatComplete({
    model: INSPECT_MODEL,
    system: INSPECT_SYSTEM,
    user:
      INSPECT_PROMPT +
      `\nViews supplied: ${JSON.stringify(present)}. Images are provided in this order: ${images
        .map((i) => i.label)
        .join(", ")}.`,
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

  // Pass 2: adjudication (text-only).
  const adjudicate = await chatComplete({
    model: ADJUDICATE_MODEL,
    system: ADJUDICATE_SYSTEM,
    user: `${ADJUDICATE_PROMPT}\n\nINSPECTION FINDINGS:\n${JSON.stringify(findings)}`,
    jsonObject: true,
    maxTokens: 1000,
    feature: "grade_adjudicate",
    userId,
    timeoutMs: 45000,
  });
  const decision = adjudicate ? safeParse(adjudicate.content) : null;

  return {
    ...findings,
    ...(decision ?? {}),
    disclaimer:
      "Not an official PSA grade. A pre-check estimate from photos to help you " +
      "decide whether to submit, sell raw, or inspect further.",
  };
}
