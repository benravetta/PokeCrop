type Json = Record<string, unknown>;

export interface ScoredCompanyEstimate {
  company: string;
  low: string;
  likely: string;
  high: string;
}

export interface ReportIntelligenceInput {
  findings: Json;
  decision: Json;
  companyEstimates: ScoredCompanyEstimate[];
  captureQuality?: Json;
  pricing?: Json | null;
}

const asObj = (v: unknown): Json =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const asNum = (v: unknown): number | null => (typeof v === "number" ? v : null);

type Defect = {
  kind: string;
  side: string;
  region: string;
  severity: "minor" | "moderate" | "major";
  note: string;
};

const IMPACT_LEVEL: Record<string, "low" | "moderate" | "high"> = {
  minor: "low",
  moderate: "moderate",
  major: "high",
};

function parseDefects(findings: Json): Defect[] {
  return asArr(findings.defects)
    .map(asObj)
    .map((d) => ({
      kind: asStr(d.kind).replace(/_/g, " "),
      side: asStr(d.side),
      region: asStr(d.region).replace(/_/g, " "),
      severity: (asStr(d.severity).toLowerCase() || "minor") as
        | "minor"
        | "moderate"
        | "major",
      note: asStr(d.note),
    }))
    .filter((d) => d.kind);
}

function prettyIssue(d: Defect): string {
  const where = [d.side, d.region].filter(Boolean).join(" ");
  const issue = `${d.severity} ${d.kind}`.trim();
  return where ? `${issue} on ${where}` : issue;
}

function pickByCategory(defects: Defect[], category: "corners" | "edges" | "surface"): Defect[] {
  const regionNeedle =
    category === "corners"
      ? "corner"
      : category === "edges"
        ? "edge"
        : "";
  const kindNeedles =
    category === "surface"
      ? ["scratch", "stain", "scuff", "print line", "indentation", "crease", "bend", "gloss loss"]
      : category === "edges"
        ? ["edge", "nick", "whitening", "chip", "split", "tear"]
        : ["corner", "whitening", "blunt", "chipping", "fray", "bend"];
  const filtered = defects.filter((d) => {
    const k = d.kind.toLowerCase();
    const r = d.region.toLowerCase();
    return (
      (regionNeedle && r.includes(regionNeedle)) ||
      kindNeedles.some((needle) => k.includes(needle))
    );
  });
  return filtered.slice(0, 4);
}

function severityWeight(defects: Defect[]): number {
  return defects.reduce((sum, d) => sum + (d.severity === "major" ? 3 : d.severity === "moderate" ? 2 : 1), 0);
}

function categoryImpactText(category: string, score: number | null, defects: Defect[]): string {
  const w = severityWeight(defects);
  if (w >= 7 || (score != null && score <= 5.9)) {
    return `${category} defects are the primary limiting factor for higher grades.`;
  }
  if (w >= 4 || (score != null && score <= 7.2)) {
    return `${category} wear is clearly visible under normal inspection and caps higher-grade outcomes.`;
  }
  return `${category} remains largely intact, but small defects still reduce top-grade probability.`;
}

function categorySection(
  label: "corners" | "edges" | "surface" | "presentation",
  findings: Json,
  defects: Defect[]
): Json {
  const key = label === "presentation" ? "eye_appeal" : label;
  const score = asNum(asObj(findings[key]).score);
  const picked = label === "presentation" ? defects.slice(0, 2) : pickByCategory(defects, label);
  const detected =
    picked.length > 0
      ? picked.map(prettyIssue)
      : [asStr(asObj(findings[key]).verdict) || "No material defect was confidently detected."];
  const impact = categoryImpactText(
    label === "presentation" ? "Presentation" : label[0].toUpperCase() + label.slice(1),
    score,
    picked
  );
  const impactLevel =
    picked.some((d) => d.severity === "major") || (score != null && score <= 5.9)
      ? "high"
      : picked.some((d) => d.severity === "moderate") || (score != null && score <= 7.2)
        ? "moderate"
        : "low";
  return {
    score,
    detected,
    impact,
    impact_level: impactLevel,
    likelihood_of_improvement: label === "presentation" ? "limited" : impactLevel === "high" ? "none" : "limited",
    safe_cleaning: label === "surface" ? impactLevel !== "high" : false,
  };
}

function parseLikelyGrade(est: ScoredCompanyEstimate | undefined): number | null {
  if (!est) return null;
  const likely = est.likely;
  const m = likely.match(/([0-9]+(?:\.[0-9]+)?)/);
  return m ? Number(m[1]) : null;
}

function companyComparison(estimates: ScoredCompanyEstimate[]): string {
  if (estimates.length < 2) return "";
  const rows = estimates
    .map((e) => ({ company: e.company, likely: parseLikelyGrade(e) }))
    .filter((e): e is { company: string; likely: number } => e.likely != null);
  if (rows.length < 2) return "";
  const hi = rows.reduce((a, b) => (a.likely > b.likely ? a : b));
  const lo = rows.reduce((a, b) => (a.likely < b.likely ? a : b));
  if (Math.abs(hi.likely - lo.likely) < 0.3) {
    return "Predicted grades are tightly aligned across companies because the same limiting defects appear consistently across grading criteria.";
  }
  return `${lo.company} trends slightly lower because its scoring is more sensitive to measurable surface and centering defects, while ${hi.company} can remain a touch higher when overall presentation is still strong.`;
}

function whyThisGrade(
  findings: Json,
  decision: Json,
  estimates: ScoredCompanyEstimate[],
  defects: Defect[]
): Json {
  const psa = estimates.find((e) => e.company === "PSA") ?? estimates[0];
  const likely = psa ? asStr(psa.likely) : "—";
  const centeringVerdict = asStr(asObj(findings.centering).verdict);
  const surfaceScore = asNum(asObj(findings.surface).score) ?? 0;
  const edgeScore = asNum(asObj(findings.edges).score) ?? 0;
  const cornerScore = asNum(asObj(findings.corners).score) ?? 0;
  const limitingAxis =
    [
      { k: "surface", v: surfaceScore },
      { k: "edges", v: edgeScore },
      { k: "corners", v: cornerScore },
    ].sort((a, b) => a.v - b.v)[0]?.k ?? "surface";
  const topDefects = defects.slice(0, 3).map(prettyIssue);
  const summary =
    asStr(decision.summary) ||
    `Predicted ${psa?.company ?? "overall"} grade ${likely} reflects visible ${limitingAxis} wear with additional supporting defects.`;

  return {
    predicted_grade: likely,
    reasoning: [
      centeringVerdict ||
        "Centering remains serviceable, but not enough to offset wear in other categories.",
      topDefects.length
        ? `Most relevant observed defects: ${topDefects.join("; ")}.`
        : "No single catastrophic defect was detected, but cumulative wear lowers the ceiling.",
      `The ${limitingAxis} category contributes most heavily to the final prediction.`,
    ],
    summary,
  };
}

function whyNotHigher(
  blockers: Json,
  defects: Defect[]
): Json {
  const primary = asArr(blockers.mint)
    .map((x) => asStr(x))
    .filter(Boolean)
    .slice(0, 3);
  const secondary = asArr(blockers.near_mint)
    .map((x) => asStr(x))
    .filter(Boolean)
    .slice(0, 2);
  const fallbackPrimary = defects
    .filter((d) => d.severity !== "minor")
    .slice(0, 3)
    .map(prettyIssue);
  return {
    target: "Higher grade tiers (8-10)",
    primary_limiting_defects: (primary.length ? primary : fallbackPrimary).map((item) => ({
      defect: item,
      explanation: "This defect remains visible during normal inspection and limits higher-grade outcomes.",
    })),
    secondary_factors: (secondary.length
      ? secondary
      : defects.filter((d) => d.severity === "minor").slice(0, 2).map(prettyIssue)
    ).map((item) => ({
      defect: item,
      explanation: "Secondary but cumulative wear lowers upside if primary issues remain.",
    })),
  };
}

function gradeCeilingAnalysis(blockers: Json, caps: unknown[]): Json {
  const capReason = caps
    .map(asObj)
    .map((c) => asStr(c.reason))
    .find(Boolean);
  return {
    gem_mint: {
      label: "Gem Mint (10)",
      prevented_by: asArr(blockers.gem_mint).map((x) => asStr(x)).filter(Boolean),
      explanation:
        asArr(blockers.gem_mint).length > 0
          ? "Top-grade tolerance is exceeded by the listed defects."
          : capReason || "No single blocker was isolated, but cumulative wear prevents Gem Mint confidence.",
    },
    mint: {
      label: "Mint (9)",
      prevented_by: asArr(blockers.mint).map((x) => asStr(x)).filter(Boolean),
      explanation:
        asArr(blockers.mint).length > 0
          ? "Mint tier is reduced by visible wear across key grading categories."
          : capReason || "Cumulative defects still hold the card below Mint.",
    },
    near_mint: {
      label: "Near Mint (8)",
      prevented_by: asArr(blockers.near_mint).map((x) => asStr(x)).filter(Boolean),
      explanation:
        asArr(blockers.near_mint).length > 0
          ? "Near Mint is limited by combined condition factors."
          : capReason || "Near Mint remains possible but less certain due to defect stack.",
    },
  };
}

function strengths(findings: Json, defects: Defect[]): string[] {
  const out: string[] = [];
  const c = asObj(findings.centering);
  const surface = asNum(asObj(findings.surface).score) ?? 0;
  const edges = asNum(asObj(findings.edges).score) ?? 0;
  const corners = asNum(asObj(findings.corners).score) ?? 0;
  if (asStr(c.front_left_right).includes("50/50") || asStr(c.front_left_right).includes("55/45")) {
    out.push("Strong front centering");
  }
  if (surface >= 7.5) out.push("No severe surface damage detected");
  if (edges >= 7.5) out.push("Edges present cleanly overall");
  if (corners >= 7.5) out.push("Corners retain good shape");
  if (asArr(findings.structural_damage).length === 0) out.push("No structural tears, holes, or missing pieces detected");
  if (!defects.some((d) => d.kind.includes("crease") || d.kind.includes("bend"))) {
    out.push("No visible creases or bends");
  }
  return out.slice(0, 6);
}

function confidence(
  findings: Json,
  captureQuality?: Json
): Json {
  let score = 92;
  const idConf = asStr(asObj(findings.card_identification).confidence).toLowerCase();
  if (idConf === "medium") score -= 6;
  if (idConf === "low") score -= 14;
  const issues = asArr(asObj(captureQuality).issues).map(asObj);
  for (const issue of issues) {
    const sev = asStr(issue.severity);
    score -= sev === "block" ? 14 : 6;
  }
  if (asObj(findings.views_present).back !== true) score -= 8;
  if (asObj(findings.image_suitability).rating === "limited") score -= 8;
  if (asObj(findings.image_suitability).rating === "poor") score -= 16;
  score = Math.max(35, Math.min(98, score));
  const level = score >= 90 ? "high" : score >= 80 ? "medium" : "low";
  return {
    score,
    level,
    warning:
      score < 80
        ? "Some defects may be hidden due to image quality. Grade estimates are less reliable than normal."
        : "",
    factors: {
      identification_confidence: idConf || "unknown",
      issue_count: issues.length,
      has_back_image: asObj(findings.views_present).back === true,
      image_rating: asStr(asObj(findings.image_suitability).rating) || "unknown",
    },
  };
}

function smartRecommendation(
  decision: Json,
  pricing?: Json | null
): Json {
  const rec = asObj(decision.submission_recommendation);
  const verdict = asStr(rec.verdict);
  const avg = asNum(asObj(asObj(pricing).ebaySold).valuation?.averageSoldPriceGbp);
  const action =
    verdict === "strong_candidate"
      ? "Worth grading"
      : verdict === "possible_candidate_inspect_first" || verdict === "only_if_value_justifies"
        ? "Grade selectively"
        : "Prefer raw";
  const worth =
    avg != null
      ? avg >= 250
        ? "Premium tiers can be justified when turnaround speed matters."
        : "Best submitted with bulk or standard service tiers."
      : "Submit only if collecting goals outweigh uncertain market value.";
  return {
    action,
    worth_grading_if: worth,
    suitable_for: ["Collection", "Binder upgrade", "Long-term hold"],
    not_recommended_for:
      action === "Worth grading"
        ? ["Unnecessary express service unless resale timing is critical"]
        : ["Premium express grading without additional upside"],
    rationale:
      asStr(rec.reason) ||
      "Recommendation balances defect profile, likely grade range, and current verified market evidence.",
  };
}

export function buildReportIntelligence(input: ReportIntelligenceInput): Json {
  const defects = parseDefects(input.findings);
  const blockers = asObj(input.decision.grade_blockers);
  const caps = asArr(input.decision.hard_grade_caps);
  return {
    category_explanations: {
      corners: categorySection("corners", input.findings, defects),
      edges: categorySection("edges", input.findings, defects),
      surface: categorySection("surface", input.findings, defects),
      presentation: categorySection("presentation", input.findings, defects),
    },
    why_this_grade: whyThisGrade(input.findings, input.decision, input.companyEstimates, defects),
    why_not_higher: whyNotHigher(blockers, defects),
    grade_ceiling_analysis: gradeCeilingAnalysis(blockers, caps),
    company_comparison_explanation: companyComparison(input.companyEstimates),
    overall_prediction_confidence: confidence(input.findings, input.captureQuality),
    strengths: strengths(input.findings, defects),
    smart_recommendation: smartRecommendation(input.decision, input.pricing),
  };
}
