import crypto from "crypto";
import { getUserRole, isAdminRole } from "./adminAccess.js";
import { getServiceClient } from "./supabase.js";
import { isInviteRequired } from "./appSettings.js";

export type InviteRole = "user" | "admin";

const INVITE_TTL_DAYS = 14;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:\s]+@[^\s@<>()[\]\\,;:\s]+\.[^\s@<>()[\]\\,;:\s]+$/;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function isBetaInviteRequired(): boolean {
  return process.env.BETA_INVITE_REQUIRED === "true";
}

/** Re-export async check used by auth and public routes. */
export { isInviteRequired } from "./appSettings.js";

/** Normalize and validate invite / SMTP recipient addresses. */
export function normalizeInviteEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  if (/[\r\n\x00]/.test(email)) return null;
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export interface InviteRecord {
  id: string;
  email: string;
  role: InviteRole;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
}

export async function createInvite(opts: {
  email: string;
  role?: InviteRole;
  invitedBy: string;
}): Promise<{ token: string; inviteId: string }> {
  const email = normalizeInviteEmail(opts.email);
  if (!email) throw new Error("Invalid email.");
  const role: InviteRole = opts.role === "admin" ? "admin" : "user";
  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();

  const { data, error } = await getServiceClient()
    .from("invites")
    .insert({
      email,
      token_hash: hashToken(token),
      role,
      invited_by: opts.invitedBy,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { token, inviteId: String(data.id) };
}

export async function resendInvite(
  inviteId: string
): Promise<{ token: string; email: string; role: InviteRole }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();
  const { data, error } = await getServiceClient()
    .from("invites")
    .update({
      token_hash: hashToken(token),
      expires_at: expiresAt,
      accepted_at: null,
      accepted_by: null,
    })
    .eq("id", inviteId)
    .is("accepted_at", null)
    .select("email, role")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Invite not found or already accepted.");
  return { token, email: data.email as string, role: data.role as InviteRole };
}

export async function validateInviteToken(token: string): Promise<
  | {
      valid: true;
      email: string;
      emailMasked: string;
      role: InviteRole;
      expiresAt: string;
    }
  | { valid: false }
> {
  if (!token || token.length > 128) return { valid: false };
  const { data } = await getServiceClient()
    .from("invites")
    .select("email, role, expires_at, accepted_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data || data.accepted_at) return { valid: false };
  if (new Date(String(data.expires_at)) < new Date()) return { valid: false };
  const email = String(data.email);
  return {
    valid: true,
    email,
    emailMasked: maskEmail(email),
    role: data.role as InviteRole,
    expiresAt: String(data.expires_at),
  };
}

export async function userHasBetaAccess(userId: string): Promise<boolean> {
  if (!(await isInviteRequired())) return true;
  const { data } = await getServiceClient()
    .from("invites")
    .select("id")
    .eq("accepted_by", userId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function promoteInvitedAdmin(userId: string): Promise<boolean> {
  const sb = getServiceClient();
  const { data: existing, error: getErr } = await sb.auth.admin.getUserById(userId);
  if (getErr || !existing.user) return false;
  const meta = { ...(existing.user.app_metadata ?? {}), role: "admin" };
  const { error: updErr } = await sb.auth.admin.updateUserById(userId, { app_metadata: meta });
  return !updErr;
}

export async function consumeInvite(
  token: string,
  userId: string,
  email: string
): Promise<{ role: InviteRole } | null> {
  const validated = await validateInviteToken(token);
  if (!validated.valid) return null;
  if (validated.email.toLowerCase() !== email.trim().toLowerCase()) return null;

  const { data, error } = await getServiceClient()
    .from("invites")
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq("token_hash", hashToken(token))
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("role")
    .maybeSingle();
  if (error || !data) return null;

  const role = data.role as InviteRole;
  if (role === "admin") {
    const ok = await promoteInvitedAdmin(userId);
    if (!ok) return null;
  }
  return { role };
}

/** Consume a pending invite matched by email (email-confirmation signup flow). */
export async function consumePendingInviteForEmail(
  userId: string,
  email: string
): Promise<{ role: InviteRole } | null> {
  const normalized = normalizeInviteEmail(email);
  if (!normalized) return null;

  const { data, error } = await getServiceClient()
    .from("invites")
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq("email", normalized)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("role")
    .maybeSingle();
  if (error || !data) return null;

  const role = data.role as InviteRole;
  if (role === "admin") {
    const ok = await promoteInvitedAdmin(userId);
    if (!ok) return null;
  }
  return { role };
}

export async function finalizeBetaAccess(opts: {
  userId: string;
  email: string;
  inviteToken?: string;
}): Promise<{ ok: true; role?: InviteRole } | { ok: false; error: string }> {
  if (!(await isInviteRequired())) return { ok: true };
  if (await userHasBetaAccess(opts.userId)) return { ok: true };
  if (isAdminRole(await getUserRole(opts.userId))) return { ok: true };

  if (opts.inviteToken) {
    const consumed = await consumeInvite(opts.inviteToken, opts.userId, opts.email);
    if (!consumed) {
      return { ok: false, error: "This invitation is invalid or has expired." };
    }
    return { ok: true, role: consumed.role };
  }

  const pending = await consumePendingInviteForEmail(opts.userId, opts.email);
  if (!pending) {
    return { ok: false, error: "This account is not authorized for beta access." };
  }
  return { ok: true, role: pending.role };
}

export async function listInvites(opts: {
  page?: number;
  pageSize?: number;
}): Promise<{ invites: InviteRecord[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const sb = getServiceClient();
  const { data, error, count } = await sb
    .from("invites")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { invites: (data ?? []) as InviteRecord[], total: count ?? 0 };
}
