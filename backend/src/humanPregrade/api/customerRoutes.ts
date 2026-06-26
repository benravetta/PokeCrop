import { Router, type Request, type Response } from "express";
import multer from "multer";
import { requireActiveAuth } from "../../middleware/auth.js";
import { rejectAdminBilling } from "../../lib/adminAccess.js";
import { getServiceClient } from "../../lib/supabase.js";
import {
  requireHumanPregradeEnabled,
  requireHumanPregradePublicEnabled,
  sendHumanPregradeError,
} from "./middleware.js";
import { humanPregradeRateLimit, humanPregradeIpRateLimit } from "./rateLimit.js";
import {
  resolvePublicOrigin,
  sanitizeCustomerReport,
  validateAISnapshotSize,
  validateGraderIds,
  assertValidImageType,
  normalizeShareToken,
  shareTokensEqual,
} from "./security.js";
import { assertMaxLength, MAX_MESSAGE_BYTES } from "../domain/limits.js";
import { getHumanPregradeSettings } from "../infrastructure/settingsRepo.js";
import {
  getOrderByPublicId,
  insertOrder,
  updateOrder,
  setOrderGraders,
  getOrderGraderIds,
  listOrdersForUserPaginated,
} from "../infrastructure/orderRepo.js";
import { listGraders } from "../infrastructure/auditRepo.js";
import { readAIReportForUser, validateAISnapshot } from "../adapters/aiReportReader.js";
import {
  linkExistingCropImage,
  listOrderImages,
  orderHasMandatoryImages,
  uploadHumanPregradeImage,
  getImageSignedUrl,
} from "../adapters/storageAdapter.js";
import { createHumanPregradeCheckout } from "../adapters/paymentAdapter.js";
import { transitionOrder } from "../application/statusService.js";
import { CUSTOMER_STATUS_LABELS, resolveCustomerProgress } from "../domain/transitions.js";
import { buildHumanPregradePdfBuffer } from "../reports/pdf.js";
import { signedGetUrl } from "../../lib/r2.js";
import { HumanPregradeError } from "../domain/types.js";
import { getStripe, isStripeConfigured } from "../../lib/stripe.js";
import { verifyTurnstileToken } from "../../lib/turnstile.js";
import {
  assertOrderReadyForCheckout,
  parseCustomerOrderDraft,
} from "../domain/customerOrderInput.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 52_428_800 },
});

export const humanPregradeCustomerRoutes = Router();

async function getOrCreateStripeCustomer(userId: string, email?: string): Promise<string> {
  const sb = getServiceClient();
  const { data } = await sb.from("subscriptions").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  const customer = await getStripe().customers.create({ email, metadata: { user_id: userId } });
  await sb.from("subscriptions").upsert(
    { user_id: userId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  return customer.id;
}

function publicOrigin(req: Request): string {
  return resolvePublicOrigin(req);
}

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim();
  return req.socket.remoteAddress;
}

async function verifyHumanPregradeTurnstile(req: Request, res: Response): Promise<boolean> {
  const token =
    typeof req.body?.turnstileToken === "string" ? req.body.turnstileToken : undefined;
  const result = await verifyTurnstileToken(token, clientIp(req));
  if (result.ok === false) {
    res.status(400).json({ error: result.message });
    return false;
  }
  return true;
}

humanPregradeCustomerRoutes.get(
  "/human-pregrades/config",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  async (_req, res) => {
    try {
      const settings = await getHumanPregradeSettings();
      const graders = await listGraders(true);
      res.json({
        enabled: settings.enabled,
        productName: settings.product_name,
        productDescription: settings.product_description,
        priceMinorUnits: settings.price_minor_units,
        currency: settings.currency,
        expectedTurnaroundHours: settings.expected_turnaround_hours,
        mandatoryImageTypes: settings.mandatory_image_types,
        supportedCardGames: settings.supported_card_games,
        customerDisclaimer: settings.customer_disclaimer,
        termsVersion: settings.terms_version,
        trainingConsentWording: settings.training_consent_wording,
        graders,
      });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.post(
  "/human-pregrades",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  humanPregradeRateLimit("create"),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const settings = await getHumanPregradeSettings();
      const body = req.body ?? {};
      const draft = parseCustomerOrderDraft(body);
      let aiSnapshot = validateAISnapshot(body.aiReportSnapshot);
      aiSnapshot = validateAISnapshotSize(aiSnapshot);
      let sourceAiReportId: number | null = null;
      if (body.sourceAiReportId != null) {
        const id = parseInt(String(body.sourceAiReportId), 10);
        const summary = await readAIReportForUser(userId, id);
        if (!summary) throw new HumanPregradeError("HUMAN_PREGRADE_NOT_FOUND", "AI report not found", 404);
        sourceAiReportId = id;
        if (summary.cardName && !body.cardName) body.cardName = summary.cardName;
        if (summary.setName && !body.setName) body.setName = summary.setName;
        if (summary.cardNumber && !body.cardNumber) body.cardNumber = summary.cardNumber;
      }

      const order = await insertOrder({
        user_id: userId,
        status: "draft",
        currency: settings.currency,
        price_minor_units: settings.price_minor_units,
        service_name_snapshot: settings.product_name,
        service_version: "1.0",
        terms_version: settings.terms_version,
        disclaimer_version: settings.disclaimer_version,
        estimated_completion_at: new Date(
          Date.now() + settings.expected_turnaround_hours * 3600_000
        ).toISOString(),
        source_ai_report_id: sourceAiReportId,
        ai_report_snapshot: aiSnapshot,
        card_game: draft.cardGame,
        card_name: draft.cardName,
        set_name: draft.setName,
        card_number: draft.cardNumber,
        release_year: body.releaseYear ?? null,
        language: body.language ?? null,
        variant: body.variant ?? null,
        finish_type: body.finishType ?? null,
        previously_graded: Boolean(body.previouslyGraded),
        previous_grader: body.previousGrader ?? null,
        previous_grade: body.previousGrade ?? null,
        known_damage: body.knownDamage ?? null,
        known_alteration: body.knownAlteration ?? null,
        customer_notes: draft.customerNotes,
        main_concern: draft.mainConcern,
        submission_recommendation_requested: Boolean(body.submissionRecommendationRequested),
        training_consent: draft.trainingConsent,
        primary_grader_id: null,
      });

      const graderIds = Array.isArray(body.selectedGraderIds)
        ? await validateGraderIds(body.selectedGraderIds.map(String))
        : [];
      if (!graderIds.length) {
        throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_INPUT", "Select at least one grader", 400);
      }
      await setOrderGraders(order.id, graderIds);

      let primaryGraderId: string | null = null;
      if (body.primaryGraderId != null && body.primaryGraderId !== "") {
        const [validated] = await validateGraderIds([String(body.primaryGraderId)]);
        primaryGraderId = validated ?? null;
        if (primaryGraderId) {
          await updateOrder(order.id, { primary_grader_id: primaryGraderId }, order.version);
        }
      }

      const refreshed = primaryGraderId
        ? await getOrderByPublicId(order.public_id)
        : order;

      res.status(201).json({ order: sanitizeCustomerOrder(refreshed ?? order) });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.get(
  "/human-pregrades",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  async (req, res) => {
    try {
      const page = parseInt(String(req.query.page ?? "1"), 10);
      const pageSize = parseInt(String(req.query.pageSize ?? "25"), 10);
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const sort =
        req.query.sort === "completed_desc" ? ("completed_desc" as const) : ("created_desc" as const);
      const { orders, total } = await listOrdersForUserPaginated({
        userId: req.user!.id,
        q,
        status,
        page,
        pageSize,
        sort,
      });
      res.json({
        orders: orders.map(sanitizeCustomerOrder),
        total,
        page: Math.max(1, page),
        pageSize: Math.min(100, Math.max(1, pageSize)),
      });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.get(
  "/human-pregrades/:publicId",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      const images = await enrichImages(await listOrderImages(order.id));
      const graderIds = await getOrderGraderIds(order.id);
      const { data: openImageRequests } = await getServiceClient()
        .from("human_pregrade_image_requests")
        .select("id, instructions, required_image_type, status")
        .eq("order_id", order.id)
        .eq("status", "open");
      res.json({ order: sanitizeCustomerOrder(order), images, graderIds, openImageRequests: openImageRequests ?? [] });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.patch(
  "/human-pregrades/:publicId/draft",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      if (order.status !== "draft" && order.status !== "awaiting_submission" && order.status !== "paid") {
        throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_STATUS", "Order not editable", 409);
      }
      const body = req.body ?? {};
      const patch: Record<string, unknown> = {};
      for (const [k, col] of [
        ["cardGame", "card_game"],
        ["cardName", "card_name"],
        ["setName", "set_name"],
        ["cardNumber", "card_number"],
        ["language", "language"],
        ["mainConcern", "main_concern"],
        ["customerNotes", "customer_notes"],
      ] as const) {
        if (body[k] !== undefined) patch[col] = body[k];
      }
      const updated = await updateOrder(order.id, patch, order.version);
      if (Array.isArray(body.selectedGraderIds)) {
        await setOrderGraders(order.id, await validateGraderIds(body.selectedGraderIds.map(String)));
      }
      res.json({ order: sanitizeCustomerOrder(updated) });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.post(
  "/human-pregrades/:publicId/images",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  humanPregradeRateLimit("upload"),
  upload.single("file"),
  async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      if (!["draft", "paid", "awaiting_submission", "awaiting_customer_images"].includes(order.status)) {
        throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_STATUS", "Cannot add images", 409);
      }
      const imageType = assertValidImageType(String(req.body?.imageType ?? "front"));
      if (req.body?.usageEventId) {
        const out = await linkExistingCropImage({
          orderId: order.id,
          userId: req.user!.id,
          imageType,
          usageEventId: parseInt(String(req.body.usageEventId), 10),
        });
        return res.status(201).json(out);
      }
      if (!req.file) throw new HumanPregradeError("HUMAN_PREGRADE_IMAGES_REQUIRED", "File required", 400);
      const out = await uploadHumanPregradeImage({
        orderId: order.id,
        userId: req.user!.id,
        imageType,
        filename: req.file.originalname,
        buffer: req.file.buffer,
        declaredMime: req.file.mimetype,
        caption: req.body?.caption,
      });
      res.status(201).json(out);
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.delete(
  "/human-pregrades/:publicId/images/:imageId",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      if (order.status !== "draft") {
        throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_STATUS", "Cannot remove images", 409);
      }
      await getServiceClient()
        .from("human_pregrade_images")
        .update({ is_active: false })
        .eq("id", req.params.imageId!)
        .eq("order_id", order.id);
      res.json({ ok: true });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.post(
  "/human-pregrades/:publicId/checkout",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  humanPregradeRateLimit("checkout"),
  async (req, res) => {
    try {
      if (!(await verifyHumanPregradeTurnstile(req, res))) return;
      if (rejectAdminBilling(req.user!.role, res)) return;
      if (!isStripeConfigured()) throw new HumanPregradeError("HUMAN_PREGRADE_PAYMENT_REQUIRED", "Billing unavailable", 503);
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      const settings = await getHumanPregradeSettings();
      await assertOrderReadyForCheckout(order, settings.mandatory_image_types);
      if (order.status === "draft") {
        await updateOrder(order.id, { status: "awaiting_payment", price_minor_units: settings.price_minor_units });
        order.status = "awaiting_payment";
      }
      const customerId = await getOrCreateStripeCustomer(req.user!.id, req.user!.email);
      const { url, sessionId } = await createHumanPregradeCheckout({
        order,
        userEmail: req.user!.email,
        origin: publicOrigin(req),
        customerId,
      });
      res.json({ url, sessionId });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.post(
  "/human-pregrades/:publicId/submit",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      if (!["paid", "awaiting_submission"].includes(order.status)) {
        throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_STATUS", "Order not ready to submit", 409);
      }
      const settings = await getHumanPregradeSettings();
      const ok = await orderHasMandatoryImages(order.id, settings.mandatory_image_types);
      if (!ok) throw new HumanPregradeError("HUMAN_PREGRADE_IMAGES_REQUIRED", "Required images missing", 400);
      if (!req.body?.termsAccepted) {
        throw new HumanPregradeError("HUMAN_PREGRADE_PAYMENT_REQUIRED", "Terms acknowledgement required", 400);
      }
      let current = order;
      if (current.status === "paid") {
        current = await transitionOrder(order.id, "awaiting_submission", {
          actorType: "customer",
          actorId: req.user!.id,
        });
      }
      current = await transitionOrder(current.id, "submitted", {
        actorType: "customer",
        actorId: req.user!.id,
        customerVisibleNote: "Your order has been submitted for expert review.",
      });
      current = await transitionOrder(current.id, "queued", {
        actorType: "system",
        actorId: null,
      });
      res.json({ order: sanitizeCustomerOrder(current) });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.get(
  "/human-pregrades/:publicId/status",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      res.json({
        status: order.status,
        customerLabel: CUSTOMER_STATUS_LABELS[order.status],
        estimatedCompletionAt: order.estimated_completion_at,
        paymentReference: order.payment_reference,
        progress: resolveCustomerProgress(order.status),
      });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.get(
  "/human-pregrades/:publicId/timeline",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      const { data } = await getServiceClient()
        .from("human_pregrade_status_history")
        .select("to_status, customer_visible_note, created_at")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true });
      const events = (data ?? [])
        .filter((row) => row.customer_visible_note || row.to_status)
        .map((row) => ({
          at: row.created_at,
          status: row.to_status,
          label: CUSTOMER_STATUS_LABELS[row.to_status as keyof typeof CUSTOMER_STATUS_LABELS] ?? row.to_status,
          note: row.customer_visible_note ?? undefined,
        }));
      res.json({ events });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

const MESSAGE_COLS = "id, body, created_at, sender_type";

humanPregradeCustomerRoutes.get(
  "/human-pregrades/:publicId/messages",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      const { data } = await getServiceClient()
        .from("human_pregrade_messages")
        .select(MESSAGE_COLS)
        .eq("order_id", order.id)
        .eq("customer_visible", true)
        .order("created_at")
        .limit(100);
      res.json({ messages: data ?? [] });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.post(
  "/human-pregrades/:publicId/messages",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  humanPregradeRateLimit("message"),
  async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      const body = assertMaxLength(String(req.body?.body ?? "").trim(), MAX_MESSAGE_BYTES, "Message");
      if (!body) return res.status(400).json({ error: "Message required." });
      const { data, error } = await getServiceClient()
        .from("human_pregrade_messages")
        .insert({
          order_id: order.id,
          sender_type: "customer",
          sender_id: req.user!.id,
          body,
          customer_visible: true,
        })
        .select(MESSAGE_COLS)
        .single();
      if (error) throw error;
      res.status(201).json({ message: data });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.post(
  "/human-pregrades/:publicId/image-requests/:requestId/fulfil",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  humanPregradeRateLimit("upload"),
  upload.single("file"),
  async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      const sb = getServiceClient();
      const { data: request } = await sb
        .from("human_pregrade_image_requests")
        .select("*")
        .eq("id", req.params.requestId!)
        .eq("order_id", order.id)
        .eq("status", "open")
        .maybeSingle();
      if (!request) throw new HumanPregradeError("HUMAN_PREGRADE_NOT_FOUND", "Request not found", 404);
      if (!req.file) throw new HumanPregradeError("HUMAN_PREGRADE_IMAGES_REQUIRED", "File required", 400);
      const imageType = assertValidImageType(String(request.required_image_type));
      const uploaded = await uploadHumanPregradeImage({
        orderId: order.id,
        userId: req.user!.id,
        imageType,
        filename: req.file.originalname,
        buffer: req.file.buffer,
        declaredMime: req.file.mimetype,
      });
      await sb
        .from("human_pregrade_image_requests")
        .update({
          status: "fulfilled",
          fulfilled_image_id: uploaded.id,
          fulfilled_at: new Date().toISOString(),
        })
        .eq("id", request.id);
      const { data: open } = await sb
        .from("human_pregrade_image_requests")
        .select("id")
        .eq("order_id", order.id)
        .eq("status", "open")
        .eq("blocks_completion", true);
      if (!open?.length) {
        await transitionOrder(order.id, "customer_images_received", {
          actorType: "customer",
          actorId: req.user!.id,
        });
        await transitionOrder(order.id, "under_review", {
          actorType: "system",
          actorId: null,
        });
      }
      res.json({ ok: true, imageId: uploaded.id });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.get(
  "/human-pregrades/:publicId/report",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      const { data: report } = await getServiceClient()
        .from("human_pregrade_reports")
        .select("*")
        .eq("order_id", order.id)
        .eq("status", "published")
        .maybeSingle();
      if (!report) throw new HumanPregradeError("HUMAN_PREGRADE_REPORT_NOT_PUBLISHED", "Report not ready", 404);
      res.json({ report: sanitizeCustomerReport(report as Record<string, unknown>) });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.get(
  "/human-pregrades/:publicId/report/pdf",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      const { data: report } = await getServiceClient()
        .from("human_pregrade_reports")
        .select("*")
        .eq("order_id", order.id)
        .eq("status", "published")
        .maybeSingle();
      if (!report) throw new HumanPregradeError("HUMAN_PREGRADE_REPORT_NOT_PUBLISHED", "Report not ready", 404);

      if (report.pdf_storage_object_id) {
        const url = await signedGetUrl(String(report.pdf_storage_object_id), 3600);
        if (url) return res.redirect(url);
      }

      const reportData = (report.report_data ?? {}) as Record<string, unknown>;
      const buf = buildHumanPregradePdfBuffer(reportData);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="expert-review-${order.public_id}.pdf"`
      );
      res.send(buf);
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.post(
  "/human-pregrades/:publicId/report/share",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      const { data: report } = await getServiceClient()
        .from("human_pregrade_reports")
        .update({ is_shareable: true })
        .eq("order_id", order.id)
        .eq("status", "published")
        .select("id")
        .maybeSingle();
      if (!report) {
        throw new HumanPregradeError("HUMAN_PREGRADE_REPORT_NOT_PUBLISHED", "Report not ready", 404);
      }
      res.json({ ok: true });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.delete(
  "/human-pregrades/:publicId/report/share",
  requireActiveAuth,
  requireHumanPregradeEnabled,
  async (req, res) => {
    try {
      const order = await loadOwnedOrder(req.user!.id, req.params.publicId!);
      const { data: report } = await getServiceClient()
        .from("human_pregrade_reports")
        .update({ is_shareable: false })
        .eq("order_id", order.id)
        .eq("status", "published")
        .select("id")
        .maybeSingle();
      if (!report) {
        throw new HumanPregradeError("HUMAN_PREGRADE_REPORT_NOT_PUBLISHED", "Report not ready", 404);
      }
      res.json({ ok: true });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

humanPregradeCustomerRoutes.get(
  "/human-pregrades/share/:token",
  requireHumanPregradePublicEnabled,
  humanPregradeIpRateLimit("share"),
  async (req, res) => {
    try {
      const token = normalizeShareToken(req.params.token ?? "");
      if (!token) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      const sb = getServiceClient();
      const { data: report } = await sb
        .from("human_pregrade_reports")
        .select(
          "id, report_data, published_at, template_version, disclaimer_version, version, pdf_storage_object_id, is_shareable, public_token, status, order_id"
        )
        .eq("public_token", token)
        .eq("status", "published")
        .eq("is_shareable", true)
        .not("published_at", "is", null)
        .maybeSingle();

      if (
        !report ||
        !report.public_token ||
        !shareTokensEqual(token, String(report.public_token))
      ) {
        res.status(404).json({ error: "Not found." });
        return;
      }

      const { data: order } = await sb
        .from("human_pregrade_orders")
        .select("status")
        .eq("id", report.order_id)
        .maybeSingle();

      if (!order || order.status !== "completed") {
        res.status(404).json({ error: "Not found." });
        return;
      }

      res.json({ report: sanitizeCustomerReport(report as Record<string, unknown>) });
    } catch (err) {
      sendHumanPregradeError(res, err);
    }
  }
);

async function loadOwnedOrder(userId: string, publicId: string) {
  const order = await getOrderByPublicId(publicId);
  if (!order || order.user_id !== userId) {
    throw new HumanPregradeError("HUMAN_PREGRADE_NOT_FOUND", "Order not found", 404);
  }
  return order;
}

function sanitizeCustomerOrder(order: Awaited<ReturnType<typeof getOrderByPublicId>>) {
  if (!order) return null;
  const progress = resolveCustomerProgress(order.status);
  return {
    publicId: order.public_id,
    status: order.status,
    customerStatusLabel: CUSTOMER_STATUS_LABELS[order.status],
    progress,
    cardGame: order.card_game,
    cardName: order.card_name,
    setName: order.set_name,
    cardNumber: order.card_number,
    priceMinorUnits: order.price_minor_units,
    currency: order.currency,
    serviceName: order.service_name_snapshot,
    estimatedCompletionAt: order.estimated_completion_at,
    submittedAt: order.submitted_at,
    completedAt: order.completed_at,
    paymentReference: order.payment_reference,
    sourceAiReportId: order.source_ai_report_id,
    hasAiSnapshot: Boolean(order.ai_report_snapshot),
    createdAt: order.created_at,
  };
}

async function enrichImages(images: Awaited<ReturnType<typeof listOrderImages>>) {
  return Promise.all(
    images.map(async (img) => ({
      ...img,
      signedUrl: img.storage_object_id
        ? await getImageSignedUrl(String(img.storage_object_id))
        : null,
    }))
  );
}

export { sanitizeCustomerOrder };
