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

// ---- Catalog (R2-backed archive of crops) ----

export interface CatalogFacet {
  label: string;
  count: number;
}

export interface CatalogItem {
  id: number;
  r2_key: string;
  tcg: string;
  card_set: string;
  number: string;
  name: string | null;
  confidence: number | null;
  source: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  url: string | null;
}

export async function adminCatalogFacets(opts: {
  tcg?: string;
  set?: string;
}): Promise<{ facets: CatalogFacet[] }> {
  const q = new URLSearchParams();
  if (opts.tcg) q.set("tcg", opts.tcg);
  if (opts.set) q.set("set", opts.set);
  const res = await fetch(`${BASE}/admin/catalog/facets?${q.toString()}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await fail(res, "Failed to load catalog facets");
  return res.json();
}

// ---- AI grading ----

export interface GradeQuota {
  plan: "free" | "unlimited" | "api";
  limit: number;
  used: number;
  remaining: number;
  window: "day" | "month";
}

// The grade result is the merged inspection + adjudication JSON; typed loosely
// since it mirrors the model's structured schema.
export type GradeResult = Record<string, unknown>;

// Located defect from the inspection pass.
export interface GradeDefect {
  kind: string;
  side: "front" | "back";
  region: string;
  bbox: number[] | null;
  severity: "minor" | "moderate" | "major";
  note?: string;
}

// A single preparation recommendation for one defect.
export interface PrepItem extends GradeDefect {
  label: string;
  location: string;
  canAttempt: boolean;
  action: string;
  method: string;
  difficulty: "easy" | "moderate" | "advanced" | "n/a";
  risk: "low" | "medium" | "high";
  reversible: boolean;
  tools: string[];
  expectedUpside: string;
  caution?: string;
}

export interface Preparation {
  items: PrepItem[];
  safeCount: number;
  avoidCount: number;
  summary: string;
  disclaimer: string;
}

export interface GradeImages {
  front: File;
  back?: File;
  angled_front?: File;
  angled_back?: File;
  closeups?: File[];
}

// Measured centering ratios (e.g. "55/45"), larger-side first, per side.
export interface MeasuredCentering {
  front?: { leftRight?: string; topBottom?: string };
  back?: { leftRight?: string; topBottom?: string };
}

export async function getGradeQuota(): Promise<{ quota: GradeQuota }> {
  const res = await fetch(`${BASE}/grade/quota`, { headers: await authHeaders() });
  if (!res.ok) await fail(res, "Failed to load grading quota");
  return res.json();
}

// Run a single photo through the crop/straighten pipeline so centering can be
// measured on a clean card. Returns a PNG data URL, or null if no card found.
export async function straightenForGrade(file: File): Promise<string | null> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${BASE}/grade/straighten`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { png?: string };
  return data.png ? `data:image/png;base64,${data.png}` : null;
}

export async function gradeCard(
  images: GradeImages,
  centering?: MeasuredCentering
): Promise<{ result: GradeResult; quota: GradeQuota }> {
  const form = new FormData();
  form.append("front", images.front);
  if (images.back) form.append("back", images.back);
  if (images.angled_front) form.append("angled_front", images.angled_front);
  if (images.angled_back) form.append("angled_back", images.angled_back);
  for (const c of images.closeups ?? []) form.append("closeups", c);
  if (centering) form.append("centering", JSON.stringify(centering));
  const res = await fetch(`${BASE}/grade`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  if (!res.ok) await fail(res, "Grading failed");
  return res.json();
}

// ---- Admin: AI spend ----

export interface AiSpend {
  total_cost_usd: number;
  total_calls: number;
  by_feature: { feature: string; calls: number; cost_usd: number }[];
  by_day: { day: string; cost_usd: number }[];
}

export async function adminGetAiSpend(days = 30): Promise<{ spend: AiSpend; days: number }> {
  const res = await fetch(`${BASE}/admin/ai-spend?days=${days}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await fail(res, "Failed to load AI spend");
  return res.json();
}

export async function adminCatalogItems(opts: {
  tcg?: string;
  set?: string;
  number?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: CatalogItem[]; total: number; limit: number; offset: number }> {
  const q = new URLSearchParams();
  if (opts.tcg) q.set("tcg", opts.tcg);
  if (opts.set) q.set("set", opts.set);
  if (opts.number) q.set("number", opts.number);
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.offset) q.set("offset", String(opts.offset));
  const res = await fetch(`${BASE}/admin/catalog/items?${q.toString()}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) await fail(res, "Failed to load catalog items");
  return res.json();
}
