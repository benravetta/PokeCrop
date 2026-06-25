import { Router, type Request } from "express";
import { requireActiveAuth } from "../../middleware/auth.js";
import { isAdminRole } from "../../lib/adminAccess.js";
import { getServiceClient } from "../../lib/supabase.js";
import {
  requireHumanPregradeEnabled,
  requireHumanPregradePermission,
  sendHumanPregradeError,
} from "./middleware.js";
import {
  getOrderById,
  listOrdersAdmin,
  updateOrder,
} from "../infrastructure/orderRepo.js";
import {
  getHumanPregradeSettings,
  updateHumanPregradeSettings,
} from "../infrastructure/settingsRepo.js";
import { listGraders, insertAuditLog } from "../infrastructure/auditRepo.js";
import { assignOrder, getCurrentAssignment } from "../application/assignmentService.js";
import { transitionOrder } from "../application/statusService.js";
import { publishReport } from "../application/reportPublisher.js";
import { issueHumanPregradeRefund } from "../adapters/paymentAdapter.js";
import { listOrderImages, getImageSignedUrl } from "../adapters/storageAdapter.js";
import { buildReportData, renderReportHtml } from "../reports/buildReport.js";
import { getOrderGraderIds } from "../infrastructure/orderRepo.js";
import { validateProbabilityDistribution, validateAssessmentComplete } from "../domain/validation.js";
import { HumanPregradeError } from "../domain/types.js";
import { getStaffPermissions } from "../infrastructure/auditRepo.js";
import { assertAssignedReviewer, assertValidImageType, sanitizeAdminOrder } from "./security.js";
import { assertMaxJsonSize, assertMaxLength, MAX_GEOMETRY_JSON, MAX_TEXT_FIELD } from "../domain/limits.js";

export const humanPregradeAdminRoutes = Router();

const adminAuth = [
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.admin.view_all"),
] as const;

function ctx(req: Request) {
  return {
    actorType: (isAdminRole(req.user?.role) ? "admin" : "reviewer") as "admin" | "reviewer" | "qa",
    actorId: req.user!.id,
    ipAddress: req.ip,
  };
}

async function requireAssigned(req: Request, orderId: string): Promise<void> {
  await assertAssignedReviewer(orderId, req.user!.id, isAdminRole(req.user?.role));
}

humanPregradeAdminRoutes.get("/admin/human-pregrades", ...adminAuth, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const orders = await listOrdersAdmin({ status, limit: 200 });
    const fullAccess = isAdminRole(req.user?.role);
    res.json({
      orders: orders.map((o) => sanitizeAdminOrder(o as unknown as Record<string, unknown>, fullAccess)),
    });
  } catch (err) {
    sendHumanPregradeError(res, err);
  }
});

humanPregradeAdminRoutes.get("/admin/human-pregrades/settings", ...adminAuth, async (_req, res) => {
  try {
    const settings = await getHumanPregradeSettings();
    const graders = await listGraders(false);
    res.json({ settings, graders });
  } catch (err) {
    sendHumanPregradeError(res, err);
  }
});

humanPregradeAdminRoutes.put(
  "/admin/human-pregrades/settings",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.admin.configure"),
  async (req, res) => {
    try {
      const settings = await updateHumanPregradeSettings(req.body ?? {});
      res.json({ settings });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeAdminRoutes.get("/admin/human-pregrades/:id", ...adminAuth, async (req, res) => {
  try {
    const order = await getOrderById(req.params.id!);
    if (!order) throw new HumanPregradeError("HUMAN_PREGRADE_NOT_FOUND", "Not found", 404);
    const sb = getServiceClient();
    const images = await listOrderImages(order.id);
    const assignment = await getCurrentAssignment(order.id);
    const enriched = await Promise.all(
      images.map(async (img) => ({
        ...img,
        signedUrl: img.storage_object_id
          ? await getImageSignedUrl(String(img.storage_object_id))
          : null,
      }))
    );
    let aiAnalysis = null;
    if (order.source_ai_report_id) {
      aiAnalysis = { usageEventId: order.source_ai_report_id, snapshot: order.ai_report_snapshot };
    }
    const { data: assessment } = await sb
      .from("human_pregrade_assessments")
      .select("*")
      .eq("order_id", order.id)
      .neq("status", "superseded")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let predictions: unknown[] = [];
    let defects: unknown[] = [];
    if (assessment) {
      const { data: preds } = await sb
        .from("human_pregrade_grader_predictions")
        .select("*")
        .eq("assessment_id", assessment.id);
      predictions = preds ?? [];
      const { data: defs } = await sb
        .from("human_pregrade_defects")
        .select("*")
        .eq("assessment_id", assessment.id)
        .order("display_order");
      defects = defs ?? [];
    }
    const { data: openImageRequests } = await sb
      .from("human_pregrade_image_requests")
      .select("*")
      .eq("order_id", order.id)
      .eq("status", "open");
    const graderIds = await getOrderGraderIds(order.id);
    const fullAccess = isAdminRole(req.user?.role);
    res.json({
      order: sanitizeAdminOrder(order as unknown as Record<string, unknown>, fullAccess),
      images: enriched,
      assignment,
      aiAnalysis: fullAccess
        ? aiAnalysis
        : aiAnalysis
          ? { usageEventId: aiAnalysis.usageEventId, hasSnapshot: Boolean(aiAnalysis.snapshot) }
          : null,
      assessment,
      predictions,
      defects,
      openImageRequests: openImageRequests ?? [],
      graderIds,
    });
  } catch (err) {
    sendHumanPregradeError(res, err);
  }
});

humanPregradeAdminRoutes.get(
  "/admin/human-pregrades/:id/report-preview",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.qa.approve"),
  async (req, res) => {
    try {
      const order = await getOrderById(req.params.id!);
      if (!order) throw new HumanPregradeError("HUMAN_PREGRADE_NOT_FOUND", "Not found", 404);
      const sb = getServiceClient();
      const { data: assessment } = await sb
        .from("human_pregrade_assessments")
        .select("*")
        .eq("order_id", order.id)
        .in("status", ["submitted", "approved"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!assessment) {
        throw new HumanPregradeError("HUMAN_PREGRADE_ASSESSMENT_INCOMPLETE", "Nothing to preview", 404);
      }
      const { data: predictions } = await sb
        .from("human_pregrade_grader_predictions")
        .select("*")
        .eq("assessment_id", assessment.id);
      const { data: defects } = await sb
        .from("human_pregrade_defects")
        .select("*")
        .eq("assessment_id", assessment.id);
      const reportData = buildReportData(
        order,
        assessment as Record<string, unknown>,
        predictions ?? [],
        defects ?? []
      );
      res.json({ reportData, htmlPreview: renderReportHtml(reportData) });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeAdminRoutes.post(
  "/admin/human-pregrades/:id/assign",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.admin.assign"),
  async (req, res) => {
    try {
      const reviewerId = String(req.body?.reviewerUserId ?? "");
      if (!reviewerId) return res.status(400).json({ error: "reviewerUserId required" });
      await assignOrder({
        orderId: req.params.id!,
        reviewerUserId: reviewerId,
        assignedByUserId: req.user!.id,
        ctx: ctx(req),
      });
      res.json({ ok: true });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeAdminRoutes.post(
  "/admin/human-pregrades/:id/start",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.reviewer.edit_assigned"),
  async (req, res) => {
    try {
      await requireAssigned(req, req.params.id!);
      await transitionOrder(req.params.id!, "under_review", {
        ...ctx(req),
        customerVisibleNote: "An expert has started reviewing your card.",
      });
      res.json({ ok: true });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeAdminRoutes.post(
  "/admin/human-pregrades/:id/request-images",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.reviewer.request_images"),
  async (req, res) => {
    try {
      await requireAssigned(req, req.params.id!);
      const instructions = assertMaxLength(
        String(req.body?.instructions ?? "").trim(),
        MAX_TEXT_FIELD,
        "Instructions"
      );
      if (!instructions) return res.status(400).json({ error: "instructions required" });
      const requiredImageType = assertValidImageType(
        String(req.body?.requiredImageType ?? "back")
      );
      const { data, error } = await getServiceClient()
        .from("human_pregrade_image_requests")
        .insert({
          order_id: req.params.id!,
          requested_by_user_id: req.user!.id,
          instructions,
          required_image_type: requiredImageType,
          blocks_completion: req.body?.blocksCompletion !== false,
        })
        .select("*")
        .single();
      if (error) throw error;
      await transitionOrder(req.params.id!, "awaiting_customer_images", {
        ...ctx(req),
        customerVisibleNote: "We need additional images to complete your review.",
      });
      res.status(201).json({ request: data });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeAdminRoutes.put(
  "/admin/human-pregrades/:id/assessment",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.reviewer.edit_assigned"),
  async (req, res) => {
    try {
      await requireAssigned(req, req.params.id!);
      const sb = getServiceClient();
      const body = req.body ?? {};
      const { data: existing } = await sb
        .from("human_pregrade_assessments")
        .select("*")
        .eq("order_id", req.params.id!)
        .eq("reviewer_user_id", req.user!.id)
        .neq("status", "superseded")
        .maybeSingle();
      const row = {
        order_id: req.params.id!,
        reviewer_user_id: req.user!.id,
        status: "draft",
        overall_condition_score: body.overallConditionScore ?? null,
        overall_confidence: body.overallConfidence ?? null,
        centering_score: body.centeringScore ?? null,
        corners_score: body.cornersScore ?? null,
        edges_score: body.edgesScore ?? null,
        surface_score: body.surfaceScore ?? null,
        print_quality_score: body.printQualityScore ?? null,
        eye_appeal_score: body.eyeAppealScore ?? null,
        image_sufficiency: assertMaxLength(body.imageSufficiency, MAX_TEXT_FIELD, "Image sufficiency"),
        alteration_risk: assertMaxLength(body.alterationRisk, MAX_TEXT_FIELD, "Alteration risk"),
        authenticity_risk: assertMaxLength(body.authenticityRisk, MAX_TEXT_FIELD, "Authenticity risk"),
        condition_summary: assertMaxLength(body.conditionSummary, MAX_TEXT_FIELD, "Condition summary"),
        key_positive_factors: assertMaxLength(body.keyPositiveFactors, MAX_TEXT_FIELD, "Key positive factors"),
        key_negative_factors: assertMaxLength(body.keyNegativeFactors, MAX_TEXT_FIELD, "Key negative factors"),
        main_grade_limiter: assertMaxLength(body.mainGradeLimiter, MAX_TEXT_FIELD, "Main grade limiter"),
        submission_recommendation: assertMaxLength(
          body.submissionRecommendation,
          MAX_TEXT_FIELD,
          "Submission recommendation"
        ),
        suggested_grader_id: body.suggestedGraderId ?? null,
        reviewer_internal_notes: assertMaxLength(
          body.reviewerInternalNotes,
          MAX_TEXT_FIELD,
          "Internal notes"
        ),
        updated_at: new Date().toISOString(),
      };
      let assessment;
      if (existing) {
        const { data, error } = await sb
          .from("human_pregrade_assessments")
          .update(row)
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        assessment = data;
      } else {
        const { data, error } = await sb.from("human_pregrade_assessments").insert(row).select("*").single();
        if (error) throw error;
        assessment = data;
      }
      res.json({ assessment });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeAdminRoutes.put(
  "/admin/human-pregrades/:id/grader-predictions",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.reviewer.edit_assigned"),
  async (req, res) => {
    try {
      await requireAssigned(req, req.params.id!);
      const predictions = Array.isArray(req.body?.predictions) ? req.body.predictions : [];
      const sb = getServiceClient();
      const { data: assessment } = await sb
        .from("human_pregrade_assessments")
        .select("id")
        .eq("order_id", req.params.id!)
        .eq("reviewer_user_id", req.user!.id)
        .neq("status", "superseded")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!assessment) throw new HumanPregradeError("HUMAN_PREGRADE_ASSESSMENT_INCOMPLETE", "No assessment", 404);
      const graders = await listGraders(true);
      const scaleById = new Map(graders.map((g) => [String(g.id), (g.grade_scale as string[]) ?? []]));
      for (const p of predictions) {
        const scale = scaleById.get(String(p.graderId)) ?? [];
        if (
          !validateProbabilityDistribution(p.probabilityDistribution ?? {}, scale)
        ) {
          throw new HumanPregradeError(
            "HUMAN_PREGRADE_PROBABILITIES_INVALID",
            "Invalid probability distribution",
            400
          );
        }
        await sb.from("human_pregrade_grader_predictions").upsert(
          {
            assessment_id: assessment.id,
            grader_id: p.graderId,
            most_likely_grade: p.mostLikelyGrade,
            minimum_grade: p.minimumGrade,
            maximum_grade: p.maximumGrade,
            confidence: p.confidence,
            probability_distribution: p.probabilityDistribution,
            main_limiter: p.mainLimiter ?? null,
            explanation: p.explanation ?? null,
            qualifier_risk: p.qualifierRisk ?? null,
            no_grade_risk: p.noGradeRisk ?? null,
            submission_recommendation: p.submissionRecommendation ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "assessment_id,grader_id" }
        );
      }
      res.json({ ok: true });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeAdminRoutes.post(
  "/admin/human-pregrades/:id/submit-for-check",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.reviewer.submit"),
  async (req, res) => {
    try {
      await requireAssigned(req, req.params.id!);
      const sb = getServiceClient();
      const { data: assessment } = await sb
        .from("human_pregrade_assessments")
        .select("*")
        .eq("order_id", req.params.id!)
        .eq("reviewer_user_id", req.user!.id)
        .neq("status", "superseded")
        .maybeSingle();
      if (!assessment || !validateAssessmentComplete(assessment as Record<string, unknown>)) {
        throw new HumanPregradeError("HUMAN_PREGRADE_ASSESSMENT_INCOMPLETE", "Assessment incomplete", 400);
      }
      const graderIds = await getOrderGraderIds(req.params.id!);
      const { data: preds } = await sb
        .from("human_pregrade_grader_predictions")
        .select("grader_id")
        .eq("assessment_id", assessment.id);
      const predGraderIds = new Set((preds ?? []).map((p) => String(p.grader_id)));
      for (const gid of graderIds) {
        if (!predGraderIds.has(gid)) {
          throw new HumanPregradeError(
            "HUMAN_PREGRADE_ASSESSMENT_INCOMPLETE",
            "Missing grader prediction",
            400
          );
        }
      }
      await sb
        .from("human_pregrade_assessments")
        .update({ status: "submitted", submitted_for_check_at: new Date().toISOString() })
        .eq("id", assessment.id);
      await transitionOrder(req.params.id!, "report_drafting", ctx(req));
      const settings = await getHumanPregradeSettings();
      if (settings.quality_check_required) {
        await transitionOrder(req.params.id!, "quality_check", ctx(req));
      }
      res.json({ ok: true });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeAdminRoutes.post(
  "/admin/human-pregrades/:id/approve",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.qa.approve"),
  async (req, res) => {
    try {
      const sb = getServiceClient();
      const isAdmin = isAdminRole(req.user?.role);
      const { data: assessment } = await sb
        .from("human_pregrade_assessments")
        .select("*")
        .eq("order_id", req.params.id!)
        .eq("status", "submitted")
        .maybeSingle();
      if (!assessment) throw new HumanPregradeError("HUMAN_PREGRADE_ASSESSMENT_INCOMPLETE", "Nothing to approve", 404);
      if (!isAdmin && String(assessment.reviewer_user_id) === req.user!.id) {
        throw new HumanPregradeError(
          "HUMAN_PREGRADE_FORBIDDEN",
          "Reviewer cannot approve their own assessment",
          403
        );
      }
      await sb
        .from("human_pregrade_assessments")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by_user_id: req.user!.id,
        })
        .eq("id", assessment.id);
      const published = await publishReport({
        orderId: req.params.id!,
        assessmentId: String(assessment.id),
        ctx: { ...ctx(req), actorType: "qa" },
      });
      res.json({ ok: true, ...published });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeAdminRoutes.post(
  "/admin/human-pregrades/:id/return",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.qa.return"),
  async (req, res) => {
    try {
      const sb = getServiceClient();
      await sb
        .from("human_pregrade_assessments")
        .update({ status: "returned" })
        .eq("order_id", req.params.id!)
        .eq("status", "submitted");
      await transitionOrder(req.params.id!, "under_review", {
        ...ctx(req),
        actorType: "qa",
        internalNote: String(req.body?.note ?? ""),
      });
      res.json({ ok: true });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeAdminRoutes.post(
  "/admin/human-pregrades/:id/unable-to-assess",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.qa.approve"),
  async (req, res) => {
    try {
      await transitionOrder(req.params.id!, "unable_to_assess", {
        ...ctx(req),
        customerVisibleNote: "We were unable to assess your card from the supplied images.",
      });
      res.json({ ok: true });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeAdminRoutes.post(
  "/admin/human-pregrades/:id/refund",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.admin.refund"),
  async (req, res) => {
    try {
      await issueHumanPregradeRefund(req.params.id!);
      await transitionOrder(req.params.id!, "refunded", {
        ...ctx(req),
        customerVisibleNote: "Your refund has been processed.",
      });
      res.json({ ok: true });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeAdminRoutes.get(
  "/admin/human-pregrades/:id/audit",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.admin.audit"),
  async (req, res) => {
    try {
      const { data } = await getServiceClient()
        .from("human_pregrade_audit_log")
        .select("*")
        .eq("order_id", req.params.id!)
        .order("created_at", { ascending: false })
        .limit(200);
      res.json({ audit: data ?? [] });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeAdminRoutes.post(
  "/admin/human-pregrades/:id/defects",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  requireHumanPregradePermission("human_pregrade.reviewer.edit_assigned"),
  async (req, res) => {
    try {
      await requireAssigned(req, req.params.id!);
      const sb = getServiceClient();
      const { data: assessment } = await sb
        .from("human_pregrade_assessments")
        .select("id")
        .eq("order_id", req.params.id!)
        .eq("reviewer_user_id", req.user!.id)
        .neq("status", "superseded")
        .maybeSingle();
      if (!assessment) throw new HumanPregradeError("HUMAN_PREGRADE_ASSESSMENT_INCOMPLETE", "No assessment", 404);
      const b = req.body ?? {};
      const title = assertMaxLength(b.title, MAX_TEXT_FIELD, "Title");
      if (!title) return res.status(400).json({ error: "title required" });
      const geometryData = assertMaxJsonSize(b.geometryData, MAX_GEOMETRY_JSON, "Geometry data");
      const { data, error } = await sb
        .from("human_pregrade_defects")
        .insert({
          assessment_id: assessment.id,
          image_id: b.imageId ?? null,
          card_side: assertMaxLength(b.cardSide, MAX_TEXT_FIELD, "Card side"),
          category: assertMaxLength(b.category, MAX_TEXT_FIELD, "Category"),
          subtype: assertMaxLength(b.subtype, MAX_TEXT_FIELD, "Subtype"),
          severity: assertMaxLength(b.severity, MAX_TEXT_FIELD, "Severity"),
          confidence: b.confidence ?? null,
          geometry_type: assertMaxLength(b.geometryType, MAX_TEXT_FIELD, "Geometry type") ?? "point",
          geometry_data: geometryData,
          title,
          description: assertMaxLength(b.description, MAX_TEXT_FIELD, "Description"),
          grading_impact: assertMaxLength(b.gradingImpact, MAX_TEXT_FIELD, "Grading impact"),
          display_order: b.displayOrder ?? 0,
          customer_visible: b.customerVisible !== false,
          created_by_user_id: req.user!.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      res.status(201).json({ defect: data });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

export { getStaffPermissions };
