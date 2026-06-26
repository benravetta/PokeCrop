import { getServiceClient } from "./supabase.js";
import { normalizeInviteEmail } from "./invites.js";

export type InviteRequestStatus = "pending" | "approved" | "rejected";

export interface InviteRequest {
  id: string;
  email: string;
  name: string | null;
  message: string | null;
  status: InviteRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  invite_id: string | null;
  created_at: string;
}

export async function createInviteRequest(opts: {
  email: string;
  name?: string | null;
  message?: string | null;
}): Promise<{ id: string }> {
  const email = normalizeInviteEmail(opts.email);
  if (!email) throw new Error("Invalid email.");

  const name =
    typeof opts.name === "string" && opts.name.trim()
      ? opts.name.trim().slice(0, 120)
      : null;
  const message =
    typeof opts.message === "string" && opts.message.trim()
      ? opts.message.trim().slice(0, 2000)
      : null;

  const { data, error } = await getServiceClient()
    .from("invite_requests")
    .insert({ email, name, message })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error("A request for this email is already pending review.");
    }
    throw error;
  }
  return { id: String(data.id) };
}

export async function listInviteRequests(opts: {
  page?: number;
  pageSize?: number;
  status?: InviteRequestStatus | "all";
}): Promise<{ requests: InviteRequestRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = getServiceClient()
    .from("invite_requests")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (opts.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  const requests = ((data ?? []) as InviteRequest[]).map(toRow);
  return { requests, total: count ?? 0, page, pageSize };
}

export async function getInviteRequest(id: string): Promise<InviteRequest | null> {
  const { data, error } = await getServiceClient()
    .from("invite_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as InviteRequest) ?? null;
}

export interface InviteRequestRow {
  id: string;
  email: string;
  name: string | null;
  message: string | null;
  status: InviteRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  inviteId: string | null;
  createdAt: string;
}

function toRow(r: InviteRequest): InviteRequestRow {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    message: r.message,
    status: r.status,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    inviteId: r.invite_id,
    createdAt: r.created_at,
  };
}

export async function markInviteRequestReviewed(
  id: string,
  status: "approved" | "rejected",
  reviewerId: string,
  inviteId?: string | null
): Promise<InviteRequest | null> {
  const { data, error } = await getServiceClient()
    .from("invite_requests")
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      invite_id: inviteId ?? null,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as InviteRequest) ?? null;
}

/** Atomically claim a pending request before sending an invite (prevents double-approve races). */
export async function claimInviteRequestApproval(
  id: string,
  reviewerId: string
): Promise<InviteRequest | null> {
  const { data, error } = await getServiceClient()
    .from("invite_requests")
    .update({
      status: "approved",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as InviteRequest) ?? null;
}

export async function linkInviteToRequest(id: string, inviteId: string): Promise<void> {
  const { error } = await getServiceClient()
    .from("invite_requests")
    .update({ invite_id: inviteId })
    .eq("id", id)
    .eq("status", "approved");
  if (error) throw error;
}

export async function revertInviteRequestApproval(id: string): Promise<void> {
  const { error } = await getServiceClient()
    .from("invite_requests")
    .update({
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      invite_id: null,
    })
    .eq("id", id)
    .eq("status", "approved")
    .is("invite_id", null);
  if (error) throw error;
}
