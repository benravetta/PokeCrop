import { supabase } from "./supabase";

const BASE = "/api";

// Error that preserves the HTTP status + parsed body so callers can react to
// specific cases (e.g. 402 quota-exceeded, 401 session expired).
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function authHeaders(
  extra: Record<string, string> = {}
): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

async function fail(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null);
  const message =
    (body && typeof body === "object" && "error" in body
      ? String((body as { error: unknown }).error)
      : "") || `${fallback}: ${res.statusText}`;
  throw new ApiError(message, res.status, body);
}

export interface ProcessParams {
  edge_sensitivity: number;
  contour_threshold: number;
  crop_padding: number;
  edge_trim: number;
  bg_removal: number;
  top_edge_cleanup: number;
  corner_radius: number;
  rotate_correction: boolean;
  // Manual orientation override in 90-degree steps (0|90|180|270), applied on
  // top of the automatic upright detection.
  output_rotation: number;
  manual_corners?: number[][];
  rotation_deg?: number;
}

export interface UploadResult {
  sessionId: string;
  filename: string;
  originalBase64: string;
}

export interface ProcessResult {
  result_web_png: string;
  edit_image_jpeg?: string;
  metadata: {
    bbox: number[];
    confidence: number;
    estimated_corner_radius_px: number;
    rotation_deg: number;
    candidates_found: number;
    selected_candidate_index: number;
    pipeline_time_ms: number;
    crop_corners?: number[][];
    edit_image_size?: [number, number];
    score_breakdown: Record<string, number>;
  };
  error?: string;
  candidates_found?: number;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  if (!res.ok) await fail(res, "Upload failed");
  return res.json();
}

export async function processImage(
  sessionId: string,
  params: ProcessParams
): Promise<ProcessResult> {
  const res = await fetch(`${BASE}/process`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ sessionId, params }),
  });
  if (!res.ok) await fail(res, "Processing failed");
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`${BASE}/session/${sessionId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
}

export async function fetchExport(
  sessionId: string,
  size: "original" | "web"
): Promise<Blob> {
  const res = await fetch(`${BASE}/export/${sessionId}?size=${size}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await fail(res, "Export failed");
  return res.blob();
}

export interface MeResponse {
  plan: "free" | "unlimited" | "api";
  cropsUsedToday: number;
  cropsRemaining: number | null;
  isAdmin: boolean;
}

export async function fetchMe(): Promise<MeResponse> {
  const res = await fetch(`${BASE}/me`, { headers: await authHeaders() });
  if (!res.ok) await fail(res, "Failed to load account");
  return res.json();
}

export async function startCheckout(plan: "unlimited" | "api"): Promise<string> {
  const res = await fetch(`${BASE}/billing/checkout`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) await fail(res, "Could not start checkout");
  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function openBillingPortal(): Promise<string> {
  const res = await fetch(`${BASE}/billing/portal`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!res.ok) await fail(res, "Could not open billing portal");
  const data = (await res.json()) as { url: string };
  return data.url;
}

// ---- API keys (self-serve, API plan) ----

export interface ApiKeySummary {
  id: string;
  label: string | null;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export async function listApiKeys(): Promise<ApiKeySummary[]> {
  const res = await fetch(`${BASE}/keys`, { headers: await authHeaders() });
  if (!res.ok) await fail(res, "Failed to load API keys");
  const data = (await res.json()) as { keys: ApiKeySummary[] };
  return data.keys;
}

export async function createApiKey(
  label?: string
): Promise<{ key: ApiKeySummary; secret: string }> {
  const res = await fetch(`${BASE}/keys`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ label: label ?? null }),
  });
  if (!res.ok) await fail(res, "Failed to create API key");
  return res.json();
}

export async function revokeApiKey(id: string): Promise<void> {
  const res = await fetch(`${BASE}/keys/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) await fail(res, "Failed to revoke API key");
}

// ---- Admin ----

export interface AdminUser {
  id: string;
  email?: string;
  role: "user" | "admin";
  created_at: string;
  suspended: boolean;
  plan: string;
  status: string | null;
  current_period_end: string | null;
  cropsUsedToday: number;
}

export interface AdminApiKey {
  id: string;
  label: string | null;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface ActivityEvent {
  id: number;
  user_id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface AdminUserDetail {
  id: string;
  email?: string;
  role: "user" | "admin";
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  suspended: boolean;
  plan: string;
  status: string | null;
  current_period_end: string | null;
  has_stripe: boolean;
  max_api_keys: number | null;
  key_limit: number;
  cropsUsedToday: number;
  activeKeys: number;
  totalKeys: number;
  activity: ActivityEvent[];
}

export interface AdminStats {
  users_total: number;
  unlimited_active: number;
  api_active: number;
  suspended: number;
  crops_web_today: number;
  crops_api_today: number;
  active_keys: number;
}

export type PlanStatus = "active" | "trialing" | "canceled";

export async function adminListUsers(opts: {
  query?: string;
  page?: number;
}): Promise<{ users: AdminUser[]; page: number; hasMore: boolean }> {
  const q = new URLSearchParams();
  if (opts.query) q.set("query", opts.query);
  if (opts.page) q.set("page", String(opts.page));
  const res = await fetch(`${BASE}/admin/users?${q.toString()}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await fail(res, "Failed to load users");
  return res.json();
}

export async function adminSetRole(id: string, role: "user" | "admin"): Promise<void> {
  const res = await fetch(`${BASE}/admin/users/${id}/role`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) await fail(res, "Failed to update role");
}

export async function adminSetPlan(
  id: string,
  plan: "free" | "unlimited" | "api",
  status?: PlanStatus
): Promise<void> {
  const res = await fetch(`${BASE}/admin/users/${id}/plan`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(status ? { plan, status } : { plan }),
  });
  if (!res.ok) await fail(res, "Failed to update plan");
}

export async function adminGetUser(id: string): Promise<{ user: AdminUserDetail }> {
  const res = await fetch(`${BASE}/admin/users/${id}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await fail(res, "Failed to load user");
  return res.json();
}

export async function adminGetStats(): Promise<{ stats: AdminStats }> {
  const res = await fetch(`${BASE}/admin/stats`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await fail(res, "Failed to load stats");
  return res.json();
}

export async function adminGetActivity(
  id: string,
  limit = 10
): Promise<{ activity: ActivityEvent[] }> {
  const res = await fetch(`${BASE}/admin/users/${id}/activity?limit=${limit}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await fail(res, "Failed to load activity");
  return res.json();
}

// Download the full (2-day) activity log for a user as a CSV file.
export async function adminDownloadActivity(id: string, email?: string): Promise<void> {
  const res = await fetch(`${BASE}/admin/users/${id}/activity?download=csv`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await fail(res, "Failed to download activity");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `activity-${email || id}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function adminSetKeyLimit(id: string, limit: number | null): Promise<void> {
  const res = await fetch(`${BASE}/admin/users/${id}/key-limit`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ limit }),
  });
  if (!res.ok) await fail(res, "Failed to update key limit");
}

export async function adminSuspend(id: string, suspended: boolean): Promise<void> {
  const res = await fetch(`${BASE}/admin/users/${id}/suspend`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ suspended }),
  });
  if (!res.ok) await fail(res, "Failed to update account");
}

export async function adminListApiKeys(id: string): Promise<{ keys: AdminApiKey[] }> {
  const res = await fetch(`${BASE}/admin/users/${id}/api-keys`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await fail(res, "Failed to load API keys");
  return res.json();
}

export async function adminCreateApiKey(
  id: string,
  label: string
): Promise<{ key: AdminApiKey; secret: string }> {
  const res = await fetch(`${BASE}/admin/users/${id}/api-keys`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ label }),
  });
  if (!res.ok) await fail(res, "Failed to issue API key");
  return res.json();
}

export async function adminRevokeApiKey(keyId: string): Promise<void> {
  const res = await fetch(`${BASE}/admin/api-keys/${keyId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) await fail(res, "Failed to revoke API key");
}
