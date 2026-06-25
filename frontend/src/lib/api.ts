import { apiFetch } from "./sessionFetch";
import type { Plan, SubscriptionPlan } from "./plans";

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

async function fail(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null);
  const message =
    (body && typeof body === "object" && "error" in body
      ? String((body as { error: unknown }).error)
      : "") || `${fallback}: ${res.statusText}`;
  throw new ApiError(message, res.status, body);
}

export interface ProcessParams {
  // Active controls for the staged pipeline.
  corner_radius: number;
  crop_padding: number;
  // Manual orientation override in 90-degree steps (0|90|180|270), applied on
  // top of the automatic upright detection.
  output_rotation: number;
  // "standard" (1260x1760) or "high" (1890x2640) output resolution.
  output_size?: "standard" | "high";
  // Manual crop corners, expressed in the rectified edit-preview's pixel space.
  manual_corners?: number[][];
  // 3x3 row-major homography mapping edit-preview pixels back to the original
  // image, paired with manual_corners so the server can re-warp from full res.
  manual_transform?: number[];
  rotation_deg?: number;
}

export interface Suitability {
  present: boolean;
  single: boolean;
  fully_visible: boolean;
  touches_edge: boolean;
  blurry: boolean;
  glare: boolean;
  sleeved: boolean;
  side: "front" | "back" | "unknown";
  orientation: "upright" | "rotated" | "upside_down" | "unknown";
  guidance: string[];
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
    needs_manual?: boolean;
    suitability?: Suitability;
    estimated_corner_radius_px: number;
    rotation_deg: number;
    orientation_deg?: number;
    candidates_found: number;
    selected_candidate_index: number;
    pipeline_time_ms: number;
    crop_corners?: number[][];
    edit_transform?: number[];
    edit_image_size?: [number, number];
    output_size?: [number, number];
    aspect?: number;
    damaged?: boolean;
    glare?: number;
    score_breakdown: Record<string, number>;
  };
  error?: string;
  candidates_found?: number;
  suitability?: Suitability;
  historyEventId?: number | null;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);

  const res = await apiFetch(`${BASE}/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) await fail(res, "Upload failed");
  return res.json();
}

export async function processImage(
  sessionId: string,
  params: ProcessParams
): Promise<ProcessResult> {
  const res = await apiFetch(`${BASE}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, params }),
  });
  if (!res.ok) await fail(res, "Processing failed");
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiFetch(`${BASE}/session/${sessionId}`, {
    method: "DELETE",
  });
}

export async function fetchExport(
  sessionId: string,
  size: "original" | "web"
): Promise<Blob> {
  const res = await apiFetch(`${BASE}/export/${sessionId}?size=${size}`, {
  });
  if (!res.ok) await fail(res, "Export failed");
  return res.blob();
}

export interface MeResponse {
  plan: Plan;
  cropsUsedToday: number;
  cropsRemaining: number | null;
  gradeCredits?: number;
  isAdmin: boolean;
}

export async function fetchMe(): Promise<MeResponse> {
  const res = await apiFetch(`${BASE}/me`);
  if (!res.ok) await fail(res, "Failed to load account");
  return res.json();
}

export async function startCheckout(plan: SubscriptionPlan): Promise<string> {
  const res = await apiFetch(`${BASE}/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) await fail(res, "Could not start checkout");
  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function openBillingPortal(): Promise<string> {
  const res = await apiFetch(`${BASE}/billing/portal`, {
    method: "POST",
  });
  if (!res.ok) await fail(res, "Could not open billing portal");
  const data = (await res.json()) as { url: string };
  return data.url;
}

// Start a one-time Checkout to buy a single grade (no subscription). Returns
// the Stripe Checkout URL to redirect to.
export async function startGradeCheckout(): Promise<{ url: string; sessionId: string }> {
  const res = await apiFetch(`${BASE}/billing/checkout-grade`, {
    method: "POST",
  });
  if (!res.ok) await fail(res, "Could not start checkout");
  return res.json() as Promise<{ url: string; sessionId: string }>;
}

export type PurchaseStatus =
  | "credited"
  | "already_credited"
  | "pending"
  | "unpaid"
  | "expired";

export async function getPurchaseStatus(
  sessionId: string
): Promise<{ status: PurchaseStatus; payment_status?: string }> {
  const res = await apiFetch(
    `${BASE}/billing/purchase-status?session_id=${encodeURIComponent(sessionId)}`,
    {  }
  );
  if (!res.ok) await fail(res, "Could not confirm purchase");
  return res.json();
}

// ---- Usage history (crops + grades) ----

export interface UsageEvent {
  id: number;
  kind: "crop" | "grade";
  source: "web" | "api";
  billing: "free" | "subscription" | "one_off";
  plan: string | null;
  quota_window: "day" | "month" | null;
  used_after: number | null;
  remaining_after: number | null;
  summary: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
  thumbnailUrl?: string | null;
}

export interface HistoryResponse {
  events: UsageEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getHistory(opts: {
  kind?: "crop" | "grade";
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<HistoryResponse> {
  const params = new URLSearchParams();
  if (opts.kind) params.set("kind", opts.kind);
  if (opts.q) params.set("q", opts.q);
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  const res = await apiFetch(`${BASE}/me/history?${params.toString()}`, {
  });
  if (!res.ok) await fail(res, "Failed to load history");
  return res.json();
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
  const res = await apiFetch(`${BASE}/keys`);
  if (!res.ok) await fail(res, "Failed to load API keys");
  const data = (await res.json()) as { keys: ApiKeySummary[] };
  return data.keys;
}

export async function createApiKey(
  label?: string
): Promise<{ key: ApiKeySummary; secret: string }> {
  const res = await apiFetch(`${BASE}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label: label ?? null }),
  });
  if (!res.ok) await fail(res, "Failed to create API key");
  return res.json();
}

export async function revokeApiKey(id: string): Promise<void> {
  const res = await apiFetch(`${BASE}/keys/${id}`, {
    method: "DELETE",
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
  grade_credits?: number;
  stripe_customer_id?: string | null;
  stripe_customer_url?: string | null;
  recentPurchases?: AdminUserPurchase[];
  recentUsage?: AdminUsageEvent[];
}

export interface AdminUserPurchase {
  id: number;
  qty: number;
  status: string;
  creditedAt: string | null;
  refundedAt: string | null;
  stripeSessionId: string | null;
}

export interface RevenueOverview {
  stripeConfigured: boolean;
  days: number;
  mrrEstimateGbp: number;
  activeSubscriptions: number;
  subscriptionsByPlan: Record<string, number>;
  oneOffRevenueGbp: number;
  oneOffPurchases: number;
  refundedPurchases: number;
  disputedPurchases: number;
  failedInvoices: number;
  pastDueSubscriptions: number;
  gradeCreditsOutstanding: number;
  note: string;
}

export interface AdminPurchase {
  id: number;
  userId: string;
  email: string | null;
  qty: number;
  status: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  creditedAt: string | null;
  refundedAt: string | null;
  amountGbp: number;
  stripeSessionUrl: string | null;
}

export interface AdminSubscription {
  userId: string;
  email: string | null;
  plan: string;
  status: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  gradeCredits: number;
  comped: boolean;
  stripeCustomerUrl: string | null;
  stripeSubscriptionUrl: string | null;
}

export interface AdminInvoice {
  id: string;
  number: string | null;
  status: string | null;
  amountDueGbp: number;
  amountPaidGbp: number;
  currency: string;
  customerId: string | null;
  customerEmail: string | null;
  userId: string | null;
  createdAt: string;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

export interface AdminFailure {
  kind: "invoice" | "dispute" | "purchase";
  id: string;
  status: string;
  amountGbp: number | null;
  email: string | null;
  userId: string | null;
  createdAt: string;
  url: string | null;
  detail: string | null;
}

export interface AdminUsageEvent {
  id: number;
  userId: string;
  email: string | null;
  kind: string;
  source: string;
  billing: string;
  plan: string | null;
  summary: string | null;
  createdAt: string;
}

export interface FormSubmission {
  id: string;
  kind: string;
  email: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface StripeEventLog {
  id: string;
  type: string;
  createdAt: string;
}

export interface AdminStats {
  users_total: number;
  unlimited_active: number;
  pro_active?: number;
  api_active: number;
  free_active?: number;
  suspended: number;
  crops_web_today: number;
  crops_api_today: number;
  grades_today?: number;
  grade_purchases_today?: number;
  grade_credits_outstanding?: number;
  active_keys: number;
  forms_total?: number;
}

export type PlanStatus = "active" | "trialing" | "canceled";

export async function adminListUsers(opts: {
  query?: string;
  page?: number;
  plan?: string;
  status?: string;
  suspended?: string;
  role?: string;
}): Promise<{ users: AdminUser[]; page: number; hasMore: boolean }> {
  const q = new URLSearchParams();
  if (opts.query) q.set("query", opts.query);
  if (opts.page) q.set("page", String(opts.page));
  if (opts.plan) q.set("plan", opts.plan);
  if (opts.status) q.set("status", opts.status);
  if (opts.suspended) q.set("suspended", opts.suspended);
  if (opts.role) q.set("role", opts.role);
  const res = await apiFetch(`${BASE}/admin/users?${q.toString()}`, {
  });
  if (!res.ok) await fail(res, "Failed to load users");
  return res.json();
}

export async function adminSetRole(id: string, role: "user" | "admin"): Promise<void> {
  const res = await apiFetch(`${BASE}/admin/users/${id}/role`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) await fail(res, "Failed to update role");
}

export async function adminSetPlan(
  id: string,
  plan: Plan,
  status?: PlanStatus
): Promise<void> {
  const res = await apiFetch(`${BASE}/admin/users/${id}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(status ? { plan, status } : { plan }),
  });
  if (!res.ok) await fail(res, "Failed to update plan");
}

export async function adminGetUser(id: string): Promise<{ user: AdminUserDetail }> {
  const res = await apiFetch(`${BASE}/admin/users/${id}`, {
  });
  if (!res.ok) await fail(res, "Failed to load user");
  return res.json();
}

export async function adminGetStats(): Promise<{ stats: AdminStats }> {
  const res = await apiFetch(`${BASE}/admin/stats`, {
  });
  if (!res.ok) await fail(res, "Failed to load stats");
  return res.json();
}

export async function adminGetActivity(
  id: string,
  limit = 10
): Promise<{ activity: ActivityEvent[] }> {
  const res = await apiFetch(`${BASE}/admin/users/${id}/activity?limit=${limit}`, {
  });
  if (!res.ok) await fail(res, "Failed to load activity");
  return res.json();
}

// Download the full (2-day) activity log for a user as a CSV file.
export async function adminDownloadActivity(id: string, email?: string): Promise<void> {
  const res = await apiFetch(`${BASE}/admin/users/${id}/activity/export`, {
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
  const res = await apiFetch(`${BASE}/admin/users/${id}/key-limit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit }),
  });
  if (!res.ok) await fail(res, "Failed to update key limit");
}

export async function adminSuspend(id: string, suspended: boolean): Promise<void> {
  const res = await apiFetch(`${BASE}/admin/users/${id}/suspend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suspended }),
  });
  if (!res.ok) await fail(res, "Failed to update account");
}

export async function adminListApiKeys(id: string): Promise<{ keys: AdminApiKey[] }> {
  const res = await apiFetch(`${BASE}/admin/users/${id}/api-keys`, {
  });
  if (!res.ok) await fail(res, "Failed to load API keys");
  return res.json();
}

export async function adminCreateApiKey(
  id: string,
  label: string
): Promise<{ key: AdminApiKey; secret: string }> {
  const res = await apiFetch(`${BASE}/admin/users/${id}/api-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  if (!res.ok) await fail(res, "Failed to issue API key");
  return res.json();
}

export async function adminRevokeApiKey(keyId: string): Promise<void> {
  const res = await apiFetch(`${BASE}/admin/api-keys/${keyId}`, {
    method: "DELETE",
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
  tcg: string;
  cardSet: string;
  number: string;
  name: string | null;
  idConfidence: number | null;
  pipelineConfidence: number | null;
  centring: CropCentring | null;
  source: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  url: string | null;
}

export async function adminCatalogFacets(opts: {
  tcg?: string;
  set?: string;
}): Promise<{ facets: CatalogFacet[] }> {
  const q = new URLSearchParams();
  if (opts.tcg) q.set("tcg", opts.tcg);
  if (opts.set) q.set("set", opts.set);
  const res = await apiFetch(`${BASE}/admin/catalog/facets?${q.toString()}`, {
  });
  if (!res.ok) await fail(res, "Failed to load catalog facets");
  return res.json();
}

// ---- AI grading ----

export interface GradeQuota {
  plan: Plan;
  limit: number;
  used: number;
  // Effective remaining = plan allowance left + purchased credits.
  remaining: number;
  window: "day" | "month";
  // Plan allowance left (excludes purchased credits).
  allowanceRemaining: number;
  // One-off grade credits the user has bought and not yet used.
  credits: number;
  isAdmin?: boolean;
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

// Rough AI-estimated market value attached to a grade result. Ballpark figures
// in the given currency (GBP), not live market data.
export interface PriceRange {
  low: number;
  high: number;
}

export interface GradedPrice {
  company: string;
  grade: string;
  low: number;
  high: number;
}

// eBay sold lookup attached to grade pricing (no external pricing APIs).
export interface EbayVerifiedSale {
  ebayItemId: string | null;
  title: string;
  url: string;
  soldDate: string;
  saleFormat: string;
  conditionOriginal: string;
  conditionNormalised: string;
  priceOriginal: number;
  currencyOriginal: string;
  exchangeRateToGbp: number | null;
  priceGbp: number | null;
  matchScore: number;
  possibleOutlier: boolean;
  evidenceLevel: "direct" | "archived";
  verificationStatus: "fully_verified" | "historically_indexed";
  sourceName: string;
  sourceUrl: string;
  marketplace: string;
  originalListingAvailable: boolean;
  originalEbayUrl?: string | null;
  verificationNotes: string[];
}

export interface EbaySoldValuation {
  status: string;
  card: Record<string, unknown>;
  sales: EbayVerifiedSale[];
  valuation: {
    salesUsed: number;
    averageSoldPriceGbp: number | null;
    medianSoldPriceGbp: number | null;
    lowestSoldPriceGbp: number | null;
    highestSoldPriceGbp: number | null;
    priceRangeGbp: number | null;
    percentageSpread: number | null;
    currency: string;
    evidenceMode?: "direct_only" | "mixed_evidence" | "archived_only" | "insufficient_sales";
    directSalesCount?: number;
    archivedSalesCount?: number;
    limitedAverageLabel?: string;
  };
  confidence: { score: number; level: string; reasons: string[] };
  warnings: string[];
  searchMetadata?: {
    searchedAt?: string;
    cacheHit?: boolean;
    directEbaySalesFound?: number;
    archivedSalesFound?: number;
    archiveSourcesChecked?: string[];
  };
}

export interface CardPricing {
  currency: string;
  raw: PriceRange;
  graded: GradedPrice[];
  confidence: "low" | "medium" | "high";
  note: string;
  source?: "cardmarket" | "pricecharting" | "ebay" | "mixed" | "ai";
  rawSource?: "cardmarket" | "pricecharting" | "ebay";
  asOf?: string;
  compCount?: number;
  ebaySold?: EbaySoldValuation;
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

export type CaptureIssueSeverity = "block" | "warn";

export interface CaptureIssue {
  code: string;
  severity: CaptureIssueSeverity;
  message: string;
}

export interface CaptureQuality {
  ok: boolean;
  score: number;
  rating: "excellent" | "good" | "limited" | "poor";
  issues: CaptureIssue[];
  front: { width: number; height: number; longEdge: number } | null;
  hasBack: boolean;
}

export async function getGradeQuota(): Promise<{ quota: GradeQuota }> {
  const res = await apiFetch(`${BASE}/grade/quota`);
  if (!res.ok) await fail(res, "Failed to load grading quota");
  return res.json();
}

// Run a single photo through the crop/straighten pipeline so centering can be
// measured on a clean card. Returns a PNG data URL, or null if no card found.
export async function straightenForGrade(file: File): Promise<string | null> {
  const form = new FormData();
  form.append("image", file);
  const res = await apiFetch(`${BASE}/grade/straighten`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { png?: string };
  return data.png ? `data:image/png;base64,${data.png}` : null;
}

export async function gradeCard(
  images: GradeImages,
  centering?: MeasuredCentering
): Promise<{ result: GradeResult; quota: GradeQuota; capture_quality?: CaptureQuality }> {
  const form = new FormData();
  form.append("front", images.front);
  if (images.back) form.append("back", images.back);
  if (images.angled_front) form.append("angled_front", images.angled_front);
  if (images.angled_back) form.append("angled_back", images.angled_back);
  for (const c of images.closeups ?? []) form.append("closeups", c);
  if (centering) form.append("centering", JSON.stringify(centering));
  const res = await apiFetch(`${BASE}/grade`, {
    method: "POST",
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
  const res = await apiFetch(`${BASE}/admin/ai-spend?days=${days}`, {
  });
  if (!res.ok) await fail(res, "Failed to load AI spend");
  return res.json();
}

export async function adminGetRevenueOverview(
  days = 30
): Promise<{ overview: RevenueOverview }> {
  const res = await apiFetch(`${BASE}/admin/revenue/overview?days=${days}`, {
  });
  if (!res.ok) await fail(res, "Failed to load revenue overview");
  return res.json();
}

export async function adminGetRevenuePurchases(opts: {
  page?: number;
  status?: string;
}): Promise<{ purchases: AdminPurchase[]; total: number; page: number; pageSize: number }> {
  const q = new URLSearchParams();
  if (opts.page) q.set("page", String(opts.page));
  if (opts.status) q.set("status", opts.status);
  const res = await apiFetch(`${BASE}/admin/revenue/purchases?${q}`, {
  });
  if (!res.ok) await fail(res, "Failed to load purchases");
  return res.json();
}

export async function adminGetRevenueSubscriptions(opts: {
  page?: number;
  plan?: string;
  status?: string;
}): Promise<{ subscriptions: AdminSubscription[]; total: number; page: number; pageSize: number }> {
  const q = new URLSearchParams();
  if (opts.page) q.set("page", String(opts.page));
  if (opts.plan) q.set("plan", opts.plan);
  if (opts.status) q.set("status", opts.status);
  const res = await apiFetch(`${BASE}/admin/revenue/subscriptions?${q}`, {
  });
  if (!res.ok) await fail(res, "Failed to load subscriptions");
  return res.json();
}

export async function adminGetRevenueInvoices(opts: {
  page?: number;
  status?: string;
}): Promise<{ invoices: AdminInvoice[]; hasMore: boolean; page: number }> {
  const q = new URLSearchParams();
  if (opts.page) q.set("page", String(opts.page));
  if (opts.status) q.set("status", opts.status);
  const res = await apiFetch(`${BASE}/admin/revenue/invoices?${q}`, {
  });
  if (!res.ok) await fail(res, "Failed to load invoices");
  return res.json();
}

export async function adminGetRevenueFailures(
  days = 30
): Promise<{ failures: AdminFailure[] }> {
  const res = await apiFetch(`${BASE}/admin/revenue/failures?days=${days}`, {
  });
  if (!res.ok) await fail(res, "Failed to load payment failures");
  return res.json();
}

export async function adminListUsageEvents(opts: {
  page?: number;
  kind?: string;
  billing?: string;
  source?: string;
  from?: string;
  to?: string;
  userId?: string;
}): Promise<{ events: AdminUsageEvent[]; total: number; page: number; pageSize: number }> {
  const q = new URLSearchParams();
  if (opts.page) q.set("page", String(opts.page));
  if (opts.kind) q.set("kind", opts.kind);
  if (opts.billing) q.set("billing", opts.billing);
  if (opts.source) q.set("source", opts.source);
  if (opts.from) q.set("from", opts.from);
  if (opts.to) q.set("to", opts.to);
  if (opts.userId) q.set("userId", opts.userId);
  const res = await apiFetch(`${BASE}/admin/usage/events?${q}`, {
  });
  if (!res.ok) await fail(res, "Failed to load usage events");
  return res.json();
}

export async function adminExportUsageEvents(opts: {
  kind?: string;
  billing?: string;
  source?: string;
  from?: string;
  to?: string;
}): Promise<void> {
  const q = new URLSearchParams();
  if (opts.kind) q.set("kind", opts.kind);
  if (opts.billing) q.set("billing", opts.billing);
  if (opts.source) q.set("source", opts.source);
  if (opts.from) q.set("from", opts.from);
  if (opts.to) q.set("to", opts.to);
  const res = await apiFetch(`${BASE}/admin/usage/events.csv?${q}`, {
  });
  if (!res.ok) await fail(res, "Failed to export usage events");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "usage-events.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function adminListFormSubmissions(opts: {
  page?: number;
  kind?: string;
}): Promise<{ submissions: FormSubmission[]; total: number; page: number; pageSize: number }> {
  const q = new URLSearchParams();
  if (opts.page) q.set("page", String(opts.page));
  if (opts.kind) q.set("kind", opts.kind);
  const res = await apiFetch(`${BASE}/admin/forms/submissions?${q}`, {
  });
  if (!res.ok) await fail(res, "Failed to load form submissions");
  return res.json();
}

export async function adminListStripeEvents(opts: {
  page?: number;
}): Promise<{ events: StripeEventLog[]; total: number; page: number; pageSize: number }> {
  const q = new URLSearchParams();
  if (opts.page) q.set("page", String(opts.page));
  const res = await apiFetch(`${BASE}/admin/stripe/events?${q}`, {
  });
  if (!res.ok) await fail(res, "Failed to load Stripe events");
  return res.json();
}

export async function adminCatalogItems(opts: {
  q?: string;
  tcg?: string;
  set?: string;
  number?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: CatalogItem[]; total: number; page: number; pageSize: number }> {
  const q = new URLSearchParams();
  if (opts.q) q.set("q", opts.q);
  if (opts.tcg) q.set("tcg", opts.tcg);
  if (opts.set) q.set("set", opts.set);
  if (opts.number) q.set("number", opts.number);
  if (opts.page) q.set("page", String(opts.page));
  if (opts.pageSize) q.set("pageSize", String(opts.pageSize));
  const res = await apiFetch(`${BASE}/admin/catalog/items?${q.toString()}`, {
  });
  if (!res.ok) await fail(res, "Failed to load catalog items");
  return res.json();
}

export interface CropCentringScores {
  PSA?: number | null;
  Beckett?: number | null;
  CGC?: number | null;
  TAG?: number | null;
  ACE?: number | null;
}

export interface CropCentring {
  measured?: boolean;
  front?: { leftRight?: string; topBottom?: string };
  scores?: CropCentringScores;
}

export async function saveHistoryCentring(
  eventId: number,
  front: { leftRight?: string; topBottom?: string }
): Promise<{ centring: CropCentring }> {
  const res = await apiFetch(`${BASE}/me/history/${eventId}/centring`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ front }),
  });
  if (!res.ok) await fail(res, "Failed to save centring");
  return res.json();
}

export async function submitContactForm(body: {
  name: string;
  email: string;
  message: string;
  turnstileToken?: string;
}): Promise<void> {
  const res = await apiFetch(`${BASE}/forms/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res, "Could not send message");
}

export async function submitTradeForm(body: {
  name: string;
  email: string;
  businessType: string;
  monthlyVolume: string;
  turnstileToken?: string;
}): Promise<void> {
  const res = await apiFetch(`${BASE}/forms/trade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res, "Could not send enquiry");
}
