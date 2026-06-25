import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getAdminHumanPregrade,
  getAdminHumanPregradeSettings,
  saveHumanPregradeAssessment,
  saveHumanPregradePredictions,
  addHumanPregradeDefect,
  submitHumanPregradeForCheck,
  approveHumanPregrade,
  returnHumanPregradeToReviewer,
  startHumanPregradeReview,
  requestHumanPregradeImages,
  getHumanPregradeReportPreview,
} from "../api";
import { customerStatusLabel } from "../copy";

type AssessmentForm = {
  conditionSummary: string;
  imageSufficiency: string;
  centeringScore: number | null;
  cornersScore: number | null;
  edgesScore: number | null;
  surfaceScore: number | null;
  printQualityScore: number | null;
  eyeAppealScore: number | null;
  alterationRisk: string;
  authenticityRisk: string;
  keyPositiveFactors: string;
  keyNegativeFactors: string;
  mainGradeLimiter: string;
  submissionRecommendation: string;
  reviewerInternalNotes: string;
};

type PredictionForm = {
  graderId: string;
  graderName: string;
  gradeScale: string[];
  mostLikelyGrade: string;
  minimumGrade: string;
  maximumGrade: string;
  confidence: number;
  explanation: string;
};

const defaultAssessment = (): AssessmentForm => ({
  conditionSummary: "",
  imageSufficiency: "adequate",
  centeringScore: null,
  cornersScore: null,
  edgesScore: null,
  surfaceScore: null,
  printQualityScore: null,
  eyeAppealScore: null,
  alterationRisk: "low",
  authenticityRisk: "low",
  keyPositiveFactors: "",
  keyNegativeFactors: "",
  mainGradeLimiter: "",
  submissionRecommendation: "",
  reviewerInternalNotes: "",
});

function mapAssessment(row: Record<string, unknown> | null): AssessmentForm {
  if (!row) return defaultAssessment();
  return {
    conditionSummary: String(row.condition_summary ?? ""),
    imageSufficiency: String(row.image_sufficiency ?? "adequate"),
    centeringScore: row.centering_score != null ? Number(row.centering_score) : null,
    cornersScore: row.corners_score != null ? Number(row.corners_score) : null,
    edgesScore: row.edges_score != null ? Number(row.edges_score) : null,
    surfaceScore: row.surface_score != null ? Number(row.surface_score) : null,
    printQualityScore: row.print_quality_score != null ? Number(row.print_quality_score) : null,
    eyeAppealScore: row.eye_appeal_score != null ? Number(row.eye_appeal_score) : null,
    alterationRisk: String(row.alteration_risk ?? "low"),
    authenticityRisk: String(row.authenticity_risk ?? "low"),
    keyPositiveFactors: String(row.key_positive_factors ?? ""),
    keyNegativeFactors: String(row.key_negative_factors ?? ""),
    mainGradeLimiter: String(row.main_grade_limiter ?? ""),
    submissionRecommendation: String(row.submission_recommendation ?? ""),
    reviewerInternalNotes: String(row.reviewer_internal_notes ?? ""),
  };
}

export function AdminHumanPregradeReviewPage() {
  const { id } = useParams();
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminHumanPregrade>> | null>(null);
  const [graders, setGraders] = useState<{ id: string; code: string; name: string; grade_scale: string[] }[]>([]);
  const [assessment, setAssessment] = useState<AssessmentForm>(defaultAssessment());
  const [predictions, setPredictions] = useState<PredictionForm[]>([]);
  const [defects, setDefects] = useState<Record<string, unknown>[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  const refresh = useCallback(() => {
    if (!id) return;
    getAdminHumanPregrade(id).then(setData);
  }, [id]);

  useEffect(() => {
    refresh();
    getAdminHumanPregradeSettings().then((r) => setGraders(r.graders ?? []));
  }, [refresh]);

  useEffect(() => {
    if (!data) return;
    setAssessment(mapAssessment(data.assessment as Record<string, unknown> | null));
    setDefects((data.defects as Record<string, unknown>[]) ?? []);
    const graderIds = (data.graderIds as string[]) ?? [];
    const existing = (data.predictions as Record<string, unknown>[]) ?? [];
    const preds: PredictionForm[] = graderIds.map((gid) => {
      const g = graders.find((x) => x.id === gid);
      const ex = existing.find((p) => String(p.grader_id) === gid);
      const scale = g?.grade_scale ?? ["10", "9", "8"];
      return {
        graderId: gid,
        graderName: g?.name ?? g?.code ?? gid,
        gradeScale: scale,
        mostLikelyGrade: String(ex?.most_likely_grade ?? scale[1] ?? "9"),
        minimumGrade: String(ex?.minimum_grade ?? scale[2] ?? "8"),
        maximumGrade: String(ex?.maximum_grade ?? scale[0] ?? "10"),
        confidence: ex?.confidence != null ? Number(ex.confidence) : 0.7,
        explanation: String(ex?.explanation ?? ""),
      };
    });
    setPredictions(preds);
  }, [data, graders]);

  const isQaMode = data?.order?.status === "quality_check" || data?.order?.status === "report_drafting";
  const readOnly = isQaMode;

  const scheduleSave = () => {
    if (!id || readOnly) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await saveHumanPregradeAssessment(id, {
          conditionSummary: assessment.conditionSummary,
          imageSufficiency: assessment.imageSufficiency,
          centeringScore: assessment.centeringScore,
          cornersScore: assessment.cornersScore,
          edgesScore: assessment.edgesScore,
          surfaceScore: assessment.surfaceScore,
          printQualityScore: assessment.printQualityScore,
          eyeAppealScore: assessment.eyeAppealScore,
          alterationRisk: assessment.alterationRisk,
          authenticityRisk: assessment.authenticityRisk,
          keyPositiveFactors: assessment.keyPositiveFactors,
          keyNegativeFactors: assessment.keyNegativeFactors,
          mainGradeLimiter: assessment.mainGradeLimiter,
          submissionRecommendation: assessment.submissionRecommendation,
          reviewerInternalNotes: assessment.reviewerInternalNotes,
        });
        if (predictions.length) {
          await saveHumanPregradePredictions(
            id,
            predictions.map((p) => {
              const rest = Math.max(0, 1 - p.confidence);
              return {
                graderId: p.graderId,
                mostLikelyGrade: p.mostLikelyGrade,
                minimumGrade: p.minimumGrade,
                maximumGrade: p.maximumGrade,
                confidence: p.confidence,
                probabilityDistribution: {
                  [p.mostLikelyGrade]: p.confidence,
                  [p.minimumGrade]: rest,
                },
                explanation: p.explanation,
              };
            })
          );
        }
      } catch {
        /* autosave silent */
      }
    }, 800);
  };

  useEffect(() => {
    scheduleSave();
  }, [assessment, predictions]);

  if (!data) return <p>Loading…</p>;
  const { order, images, aiAnalysis } = data;

  const handleSubmit = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await saveHumanPregradeAssessment(id, assessment);
      await saveHumanPregradePredictions(
        id,
        predictions.map((p) => {
          const rest = Math.max(0, 1 - p.confidence);
          return {
            graderId: p.graderId,
            mostLikelyGrade: p.mostLikelyGrade,
            minimumGrade: p.minimumGrade,
            maximumGrade: p.maximumGrade,
            confidence: p.confidence,
            probabilityDistribution: {
              [p.mostLikelyGrade]: p.confidence,
              [p.minimumGrade]: rest,
            },
            explanation: p.explanation,
          };
        })
      );
      await submitHumanPregradeForCheck(id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const { htmlPreview } = await getHumanPregradeReportPreview(id);
      setPreviewHtml(htmlPreview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!id || !window.confirm("Publish this report to the customer?")) return;
    setBusy(true);
    try {
      await approveHumanPregrade(id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  };

  const scoreInput = (label: string, key: keyof AssessmentForm) => (
    <label className="block text-xs">
      {label}
      <input
        type="number"
        min={1}
        max={10}
        step={0.5}
        disabled={readOnly}
        className="mt-1 w-full rounded border border-border-subtle bg-surface px-2 py-1"
        value={assessment[key] ?? ""}
        onChange={(e) =>
          setAssessment({ ...assessment, [key]: e.target.value ? Number(e.target.value) : null })
        }
      />
    </label>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/admin/human-pregrades" className="text-sm text-text-muted">← Queue</Link>
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">{order.card_name ?? "Review"}</h1>
        <p className="text-sm text-text-muted">
          {customerStatusLabel(order.status)} · {order.set_name} {order.card_number}
        </p>
      </header>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      {order.status === "assigned" ? (
        <button
          type="button"
          className="rounded-lg bg-accent text-white px-4 py-2 text-sm"
          onClick={() => id && startHumanPregradeReview(id).then(refresh)}
        >
          Start review
        </button>
      ) : null}

      {aiAnalysis ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <strong>Existing AI analysis</strong> (read-only reference)
        </div>
      ) : null}

      <section>
        <h2 className="text-sm font-medium mb-2">Images</h2>
        <div className="grid grid-cols-2 gap-3">
          {(images ?? []).map((img: { id: string; image_type: string; signedUrl?: string | null }) => (
            <div key={img.id} className="rounded-lg border border-border-subtle overflow-hidden">
              <p className="text-xs p-2 bg-surface-overlay">{img.image_type}</p>
              {img.signedUrl ? (
                <img src={img.signedUrl} alt={img.image_type} className="w-full aspect-[3/4] object-contain bg-black/20" />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border-subtle p-4">
        <h2 className="text-sm font-medium">Image quality</h2>
        <label className="block text-xs">
          Image sufficiency
          <select
            disabled={readOnly}
            className="mt-1 w-full rounded border border-border-subtle bg-surface px-2 py-1"
            value={assessment.imageSufficiency}
            onChange={(e) => setAssessment({ ...assessment, imageSufficiency: e.target.value })}
          >
            <option value="adequate">Adequate</option>
            <option value="marginal">Marginal</option>
            <option value="insufficient">Insufficient</option>
          </select>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {scoreInput("Centering", "centeringScore")}
          {scoreInput("Corners", "cornersScore")}
          {scoreInput("Edges", "edgesScore")}
          {scoreInput("Surface", "surfaceScore")}
          {scoreInput("Print", "printQualityScore")}
          {scoreInput("Eye appeal", "eyeAppealScore")}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border-subtle p-4">
        <h2 className="text-sm font-medium">Condition narrative</h2>
        <textarea
          disabled={readOnly}
          className="w-full rounded-lg border border-border-subtle bg-surface p-3 text-sm min-h-[80px]"
          placeholder="Condition summary (required)"
          value={assessment.conditionSummary}
          onChange={(e) => setAssessment({ ...assessment, conditionSummary: e.target.value })}
        />
        <textarea
          disabled={readOnly}
          className="w-full rounded-lg border border-border-subtle bg-surface p-3 text-sm"
          placeholder="Main grade limiter (required)"
          value={assessment.mainGradeLimiter}
          onChange={(e) => setAssessment({ ...assessment, mainGradeLimiter: e.target.value })}
        />
        <textarea
          disabled={readOnly}
          className="w-full rounded-lg border border-border-subtle bg-surface p-3 text-sm"
          placeholder="Key positive factors"
          value={assessment.keyPositiveFactors}
          onChange={(e) => setAssessment({ ...assessment, keyPositiveFactors: e.target.value })}
        />
        <textarea
          disabled={readOnly}
          className="w-full rounded-lg border border-border-subtle bg-surface p-3 text-sm"
          placeholder="Key negative factors"
          value={assessment.keyNegativeFactors}
          onChange={(e) => setAssessment({ ...assessment, keyNegativeFactors: e.target.value })}
        />
      </section>

      {predictions.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-border-subtle p-4">
          <h2 className="text-sm font-medium">Grader predictions</h2>
          {predictions.map((p, i) => (
            <div key={p.graderId} className="rounded-lg bg-surface-overlay p-3 space-y-2">
              <p className="text-xs font-medium">{p.graderName}</p>
              <div className="grid grid-cols-3 gap-2">
                {(["mostLikelyGrade", "minimumGrade", "maximumGrade"] as const).map((field) => (
                  <label key={field} className="text-xs">
                    {field === "mostLikelyGrade" ? "Most likely" : field === "minimumGrade" ? "Min" : "Max"}
                    <select
                      disabled={readOnly}
                      className="mt-1 w-full rounded border border-border-subtle bg-surface px-1 py-1"
                      value={p[field]}
                      onChange={(e) => {
                        const next = [...predictions];
                        next[i] = { ...p, [field]: e.target.value };
                        setPredictions(next);
                      }}
                    >
                      {p.gradeScale.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <label className="block text-xs">
                Confidence (0–1)
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={readOnly}
                  className="mt-1 w-full rounded border border-border-subtle bg-surface px-2 py-1"
                  value={p.confidence}
                  onChange={(e) => {
                    const next = [...predictions];
                    next[i] = { ...p, confidence: Number(e.target.value) };
                    setPredictions(next);
                  }}
                />
              </label>
              <textarea
                disabled={readOnly}
                className="w-full rounded border border-border-subtle bg-surface p-2 text-xs"
                placeholder="Explanation"
                value={p.explanation}
                onChange={(e) => {
                  const next = [...predictions];
                  next[i] = { ...p, explanation: e.target.value };
                  setPredictions(next);
                }}
              />
            </div>
          ))}
        </section>
      ) : null}

      {!readOnly ? (
        <section className="space-y-2 rounded-xl border border-border-subtle p-4">
          <h2 className="text-sm font-medium">Defects</h2>
          <ul className="text-xs space-y-1">
            {defects.map((d) => (
              <li key={String(d.id)}>{String(d.title)} ({String(d.severity)})</li>
            ))}
          </ul>
          <button
            type="button"
            className="text-xs text-accent"
            onClick={async () => {
              if (!id) return;
              const title = window.prompt("Defect title");
              if (!title) return;
              await addHumanPregradeDefect(id, {
                title,
                category: "surface",
                severity: "moderate",
                geometryType: "point",
              });
              refresh();
            }}
          >
            + Add defect
          </button>
        </section>
      ) : null}

      {!readOnly ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-text-muted">Internal notes</summary>
          <textarea
            className="mt-2 w-full rounded border border-border-subtle bg-surface p-2"
            value={assessment.reviewerInternalNotes}
            onChange={(e) => setAssessment({ ...assessment, reviewerInternalNotes: e.target.value })}
          />
        </details>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!readOnly && ["under_review", "customer_images_received"].includes(order.status) ? (
          <>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-accent text-white px-3 py-1.5 text-sm"
              onClick={handleSubmit}
            >
              Submit for QA
            </button>
            <button
              type="button"
              className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm"
              onClick={async () => {
                if (!id) return;
                const instructions = window.prompt("What images do you need?");
                if (!instructions) return;
                await requestHumanPregradeImages(id, {
                  instructions,
                  requiredImageType: "back",
                });
                refresh();
              }}
            >
              Request images
            </button>
          </>
        ) : null}
        {isQaMode ? (
          <>
            <button type="button" className="rounded-lg border border-border-subtle px-3 py-1.5 text-sm" onClick={handlePreview}>
              Preview report
            </button>
            <button
              type="button"
              className="rounded-lg border border-amber-500/50 px-3 py-1.5 text-sm"
              onClick={() => {
                const note = window.prompt("Return note for reviewer");
                if (id) returnHumanPregradeToReviewer(id, note ?? undefined).then(refresh);
              }}
            >
              Return to reviewer
            </button>
            <button type="button" disabled={busy} className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm" onClick={handleApprove}>
              Approve & publish
            </button>
          </>
        ) : null}
      </div>

      {previewHtml ? (
        <section className="rounded-xl border border-border-subtle overflow-hidden">
          <div className="p-2 bg-surface-overlay text-xs font-medium">Report preview</div>
          <iframe title="Report preview" srcDoc={previewHtml} className="w-full h-[480px] bg-white" />
        </section>
      ) : null}
    </div>
  );
}
