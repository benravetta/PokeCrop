import { getServiceClient } from "../../lib/supabase.js";
import type { HumanPregradeOrderRow } from "../domain/types.js";
import { sanitizeOrderSearchQuery } from "../api/security.js";

const ORDER_COLS =
  "id, public_id, user_id, status, version, payment_reference, currency, price_minor_units, service_name_snapshot, service_version, source_card_id, source_ai_report_id, ai_report_snapshot, primary_grader_id, card_game, card_name, set_name, card_number, release_year, language, variant, finish_type, declared_value_minor_units, declared_value_currency, previously_graded, previous_grader, previous_grade, known_damage, known_alteration, customer_notes, main_concern, submission_recommendation_requested, training_consent, terms_version, disclaimer_version, estimated_completion_at, submitted_at, assigned_at, review_started_at, completed_at, cancelled_at, refunded_at, created_at, updated_at";

export async function getOrderByPublicId(publicId: string): Promise<HumanPregradeOrderRow | null> {
  const { data, error } = await getServiceClient()
    .from("human_pregrade_orders")
    .select(ORDER_COLS)
    .eq("public_id", publicId)
    .maybeSingle();
  if (error) throw error;
  return data as HumanPregradeOrderRow | null;
}

export async function getOrderById(id: string): Promise<HumanPregradeOrderRow | null> {
  const { data, error } = await getServiceClient()
    .from("human_pregrade_orders")
    .select(ORDER_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as HumanPregradeOrderRow | null;
}

export async function listOrdersForUser(userId: string): Promise<HumanPregradeOrderRow[]> {
  const { data, error } = await getServiceClient()
    .from("human_pregrade_orders")
    .select(ORDER_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HumanPregradeOrderRow[];
}

const IN_PROGRESS_STATUSES = [
  "awaiting_payment",
  "paid",
  "awaiting_submission",
  "submitted",
  "queued",
  "assigned",
  "under_review",
  "awaiting_customer_images",
  "customer_images_received",
  "report_drafting",
  "quality_check",
];

export async function listOrdersForUserPaginated(opts: {
  userId: string;
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: "created_desc" | "completed_desc";
}): Promise<{ orders: HumanPregradeOrderRow[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = getServiceClient()
    .from("human_pregrade_orders")
    .select(ORDER_COLS, { count: "exact" })
    .eq("user_id", opts.userId);

  if (opts.q?.trim()) {
    const term = sanitizeOrderSearchQuery(opts.q);
    if (term) {
      const pattern = `%${term}%`;
      q = q.or(`card_name.ilike.${pattern},set_name.ilike.${pattern},card_number.ilike.${pattern}`);
    }
  }

  if (opts.status === "completed") {
    q = q.eq("status", "completed");
  } else if (opts.status === "in_progress") {
    q = q.in("status", IN_PROGRESS_STATUSES);
  } else if (opts.status === "unable_to_assess") {
    q = q.eq("status", "unable_to_assess");
  } else if (opts.status) {
    q = q.eq("status", opts.status);
  }

  if (opts.sort === "completed_desc") {
    q = q.order("completed_at", { ascending: false, nullsFirst: false });
  } else {
    q = q.order("created_at", { ascending: false });
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { orders: (data ?? []) as HumanPregradeOrderRow[], total: count ?? 0 };
}

export async function insertOrder(
  row: Record<string, unknown>
): Promise<HumanPregradeOrderRow> {
  const { data, error } = await getServiceClient()
    .from("human_pregrade_orders")
    .insert(row)
    .select(ORDER_COLS)
    .single();
  if (error) throw error;
  return data as HumanPregradeOrderRow;
}

export async function updateOrder(
  id: string,
  patch: Record<string, unknown>,
  expectedVersion?: number
): Promise<HumanPregradeOrderRow> {
  let q = getServiceClient().from("human_pregrade_orders").update({
    ...patch,
    updated_at: new Date().toISOString(),
    version: expectedVersion != null ? expectedVersion + 1 : undefined,
  });
  q = q.eq("id", id);
  if (expectedVersion != null) q = q.eq("version", expectedVersion);
  const { data, error } = await q.select(ORDER_COLS).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Order update conflict or not found");
  return data as HumanPregradeOrderRow;
}

export async function listOrdersAdmin(filters: {
  status?: string;
  reviewerId?: string;
  limit?: number;
}): Promise<HumanPregradeOrderRow[]> {
  let q = getServiceClient()
    .from("human_pregrade_orders")
    .select(ORDER_COLS)
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .limit(filters.limit ?? 100);
  if (filters.status) q = q.eq("status", filters.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as HumanPregradeOrderRow[];
}

export async function setOrderGraders(orderId: string, graderIds: string[]): Promise<void> {
  const sb = getServiceClient();
  await sb.from("human_pregrade_order_graders").delete().eq("order_id", orderId);
  if (!graderIds.length) return;
  const { error } = await sb.from("human_pregrade_order_graders").insert(
    graderIds.map((grader_id) => ({ order_id: orderId, grader_id }))
  );
  if (error) throw error;
}

export async function getOrderGraderIds(orderId: string): Promise<string[]> {
  const { data, error } = await getServiceClient()
    .from("human_pregrade_order_graders")
    .select("grader_id")
    .eq("order_id", orderId);
  if (error) throw error;
  return (data ?? []).map((r) => String(r.grader_id));
}
