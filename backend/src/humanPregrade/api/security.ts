import type { Request } from "express";
import { isAdminRole } from "../../lib/adminAccess.js";
import { getServiceClient } from "../../lib/supabase.js";
import { HumanPregradeError } from "../domain/types.js";
import { hasHumanPregradePermission } from "../permissions/index.js";
import { getStaffPermissions } from "../infrastructure/auditRepo.js";

/** Strip PostgREST filter metacharacters and ILIKE wildcards from customer search input. */
export function sanitizeOrderSearchQuery(raw: string): string {
  return raw
    .trim()
    .slice(0, 100)
    .replace(/[,().\\%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolvePublicOrigin(req: Request): string {
  const configured = process.env.PUBLIC_ORIGIN?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new HumanPregradeError(
      "HUMAN_PREGRADE_PAYMENT_REQUIRED",
      "Checkout is temporarily unavailable.",
      503
    );
  }
  const host = req.get("host") ?? "localhost:8080";
  return `${req.protocol}://${host}`;
}

export async function assertAssignedReviewer(
  orderId: string,
  userId: string,
  isAdmin: boolean
): Promise<void> {
  if (isAdmin) return;
  const { data: assignment } = await getServiceClient()
    .from("human_pregrade_assignments")
    .select("reviewer_user_id")
    .eq("order_id", orderId)
    .eq("is_current", true)
    .maybeSingle();
  if (!assignment || String(assignment.reviewer_user_id) !== userId) {
    throw new HumanPregradeError(
      "HUMAN_PREGRADE_FORBIDDEN",
      "This order is not assigned to you.",
      403
    );
  }
}

export async function assertReviewerStaff(userId: string): Promise<void> {
  const perms = await getStaffPermissions(userId);
  const ok =
    hasHumanPregradePermission(perms, "human_pregrade.reviewer.edit_assigned", false) ||
    hasHumanPregradePermission(perms, "human_pregrade.admin.view_all", false);
  if (!ok) {
    throw new HumanPregradeError(
      "HUMAN_PREGRADE_FORBIDDEN",
      "User is not an eligible reviewer.",
      403
    );
  }
}

export function sanitizeCustomerReport(report: Record<string, unknown>) {
  return {
    reportType: "human_expert_review" as const,
    reportData: report.report_data ?? {},
    publishedAt: report.published_at ?? null,
    templateVersion: report.template_version ?? null,
    disclaimerVersion: report.disclaimer_version ?? null,
    version: report.version ?? 1,
    hasPdf: Boolean(report.pdf_storage_object_id),
    isShareable: Boolean(report.is_shareable),
  };
}

const VALID_IMAGE_TYPES = new Set([
  "front",
  "back",
  "front_angled",
  "back_angled",
  "front_corner",
  "back_corner",
  "edge",
  "surface",
  "other",
  "tilt_video",
]);

export function assertValidImageType(imageType: string): string {
  const t = imageType.trim().toLowerCase();
  if (!VALID_IMAGE_TYPES.has(t)) {
    throw new HumanPregradeError("HUMAN_PREGRADE_IMAGES_REQUIRED", "Invalid image type", 400);
  }
  return t;
}

const MAX_SNAPSHOT_BYTES = 32_768;

export function validateAISnapshotSize(snapshot: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!snapshot) return null;
  const serialized = JSON.stringify(snapshot);
  if (serialized.length > MAX_SNAPSHOT_BYTES) {
    throw new HumanPregradeError(
      "HUMAN_PREGRADE_INVALID_INPUT",
      "AI report snapshot is too large",
      400
    );
  }
  return snapshot;
}

export async function validateGraderIds(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const unique = [...new Set(ids.map(String))];
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("human_pregrade_graders")
    .select("id")
    .eq("enabled", true)
    .in("id", unique);
  if (error) throw error;
  const found = new Set((data ?? []).map((r) => String(r.id)));
  for (const id of unique) {
    if (!found.has(id)) {
      throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_INPUT", "Invalid grader selection", 400);
    }
  }
  return unique;
}

export function sanitizeAdminOrder(
  order: Record<string, unknown>,
  fullAccess: boolean
): Record<string, unknown> {
  if (fullAccess) return order;
  return {
    id: order.id,
    public_id: order.public_id,
    status: order.status,
    version: order.version,
    card_game: order.card_game,
    card_name: order.card_name,
    set_name: order.set_name,
    card_number: order.card_number,
    language: order.language,
    variant: order.variant,
    finish_type: order.finish_type,
    main_concern: order.main_concern,
    customer_notes: order.customer_notes,
    price_minor_units: order.price_minor_units,
    currency: order.currency,
    service_name_snapshot: order.service_name_snapshot,
    estimated_completion_at: order.estimated_completion_at,
    submitted_at: order.submitted_at,
    completed_at: order.completed_at,
    source_ai_report_id: order.source_ai_report_id,
    has_ai_snapshot: Boolean(order.ai_report_snapshot),
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}
