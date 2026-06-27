import { getServiceClient } from "../../lib/supabase.js";
import { getGradeQuota, incrementGrade, consumeGradeCredit } from "../../lib/gradeQuota.js";
import type { UserRole } from "../../lib/adminAccess.js";
import { CollectorProfileError, generatePublicId } from "../domain/types.js";

export interface EntitlementOption {
  id: string;
  type: "subscription" | "credit" | "one_off";
  label: string;
  remaining?: number;
  costMinorUnits?: number;
}

export async function getAvailableEntitlements(
  userId: string,
  role?: UserRole
): Promise<EntitlementOption[]> {
  const quota = await getGradeQuota(userId, role);
  const options: EntitlementOption[] = [];
  if (quota.allowanceRemaining > 0) {
    options.push({
      id: "subscription",
      type: "subscription",
      label: quota.plan === "free" ? "Free allowance" : "Subscription allowance",
      remaining: quota.allowanceRemaining,
    });
  }
  if (quota.credits > 0) {
    options.push({
      id: "credit",
      type: "credit",
      label: "Grading credits",
      remaining: quota.credits,
    });
  }
  options.push({
    id: "one_off",
    type: "one_off",
    label: "Pay for one grade",
  });
  return options;
}

export async function reserveEntitlement(opts: {
  userId: string;
  cardId: string;
  entitlementType: "subscription" | "credit" | "promotional" | "one_off";
  ttlMinutes?: number;
}): Promise<{ reservationId: string }> {
  const expiresAt = new Date(Date.now() + (opts.ttlMinutes ?? 15) * 60_000).toISOString();
  const { data, error } = await getServiceClient()
    .from("collector_entitlement_reservations")
    .insert({
      user_id: opts.userId,
      card_id: opts.cardId,
      entitlement_type: opts.entitlementType,
      status: "reserved",
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { reservationId: String(data.id) };
}

export async function getValidatedReservation(
  reservationId: string,
  userId: string,
  cardId: string
) {
  const { data: reservation, error: fetchErr } = await getServiceClient()
    .from("collector_entitlement_reservations")
    .select("*")
    .eq("id", reservationId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!reservation || reservation.status !== "reserved") {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Invalid reservation.", 409);
  }
  if (reservation.user_id !== userId || reservation.card_id !== cardId) {
    throw new CollectorProfileError("COLLECTOR_FORBIDDEN", "Invalid reservation.", 403);
  }
  if (new Date(reservation.expires_at).getTime() < Date.now()) {
    throw new CollectorProfileError("COLLECTOR_INVALID_INPUT", "Reservation expired.", 409);
  }
  return reservation;
}

export async function consumeReservedEntitlement(
  reservationId: string,
  userId: string,
  cardId: string,
  gradingOrderId: number
): Promise<void> {
  const reservation = await getValidatedReservation(reservationId, userId, cardId);

  if (reservation.entitlement_type === "subscription") {
    await incrementGrade(reservation.user_id);
  } else if (reservation.entitlement_type === "credit") {
    const left = await consumeGradeCredit(reservation.user_id);
    if (left < 0) {
      throw new CollectorProfileError("COLLECTOR_PAYMENT_REQUIRED", "No credits available.", 402);
    }
  }

  await getServiceClient()
    .from("collector_entitlement_reservations")
    .update({ status: "consumed" })
    .eq("id", reservationId);
  void gradingOrderId;
}

export async function releaseReservation(reservationId: string): Promise<void> {
  await getServiceClient()
    .from("collector_entitlement_reservations")
    .update({ status: "released" })
    .eq("id", reservationId)
    .eq("status", "reserved");
}

export async function getLatestUsageEventId(userId: string): Promise<number | null> {
  const { data } = await getServiceClient()
    .from("usage_events")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "grade")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return typeof data?.id === "number" ? data.id : null;
}

export function newGradeLinkPublicRef(): string {
  return generatePublicId("gl");
}
