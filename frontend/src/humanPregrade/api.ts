import { apiFetch } from "../lib/sessionFetch";
import type { CustomerProgress } from "./copy";

const BASE = "/api";

async function fail(res: Response): Promise<never> {
  let body: { error?: string; error_code?: string } = {};
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  throw new Error(body.error ?? `Request failed (${res.status})`);
}

export interface HumanPregradeConfig {
  enabled: boolean;
  productName: string;
  productDescription: string;
  priceMinorUnits: number;
  currency: string;
  expectedTurnaroundHours: number;
  mandatoryImageTypes: string[];
  supportedCardGames: string[];
  customerDisclaimer: string;
  termsVersion: string;
  trainingConsentWording: string;
  graders: { id: string; code: string; name: string; grade_scale: string[] }[];
}

export interface HumanPregradeOrderSummary {
  publicId: string;
  status: string;
  customerStatusLabel: string;
  progress?: CustomerProgress;
  cardGame: string | null;
  cardName: string | null;
  setName: string | null;
  cardNumber: string | null;
  priceMinorUnits: number;
  currency: string;
  serviceName: string;
  estimatedCompletionAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  paymentReference: string | null;
  sourceAiReportId: number | null;
  hasAiSnapshot: boolean;
  createdAt: string;
}

export interface ListHumanPregradeOrdersOpts {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: "created_desc" | "completed_desc";
}

export async function fetchHumanPregradeConfig(): Promise<HumanPregradeConfig | null> {
  const res = await apiFetch(`${BASE}/human-pregrades/config`);
  if (res.status === 404) return null;
  if (!res.ok) await fail(res);
  return res.json();
}

export async function createHumanPregradeOrder(body: Record<string, unknown>) {
  const res = await apiFetch(`${BASE}/human-pregrades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function listHumanPregradeOrders(
  opts: ListHumanPregradeOrdersOpts = {}
): Promise<{ orders: HumanPregradeOrderSummary[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.status) params.set("status", opts.status);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts.sort) params.set("sort", opts.sort);
  const qs = params.toString();
  const res = await apiFetch(`${BASE}/human-pregrades${qs ? `?${qs}` : ""}`, {
      });
  if (res.status === 404) return { orders: [], total: 0, page: 1, pageSize: 25 };
  if (!res.ok) await fail(res);
  return res.json();
}

export async function getHumanPregradeOrder(publicId: string) {
  const res = await apiFetch(`${BASE}/human-pregrades/${publicId}`);
  if (!res.ok) await fail(res);
  return res.json();
}

export async function getHumanPregradeStatus(publicId: string) {
  const res = await apiFetch(`${BASE}/human-pregrades/${publicId}/status`, {
      });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function getHumanPregradeTimeline(publicId: string) {
  const res = await apiFetch(`${BASE}/human-pregrades/${publicId}/timeline`, {
      });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function listHumanPregradeMessages(publicId: string) {
  const res = await apiFetch(`${BASE}/human-pregrades/${publicId}/messages`, {
      });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function fulfilHumanPregradeImageRequest(
  publicId: string,
  requestId: string,
  file: File
) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await apiFetch(
    `${BASE}/human-pregrades/${publicId}/image-requests/${requestId}/fulfil`,
    { method: "POST", body: fd }
  );
  if (!res.ok) await fail(res);
  return res.json();
}

export async function patchHumanPregradeDraft(publicId: string, body: Record<string, unknown>) {
  const res = await apiFetch(`${BASE}/human-pregrades/${publicId}/draft`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function uploadHumanPregradeImage(
  publicId: string,
  file: File,
  imageType: string,
  usageEventId?: number
) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("imageType", imageType);
  if (usageEventId) fd.append("usageEventId", String(usageEventId));
  const res = await apiFetch(`${BASE}/human-pregrades/${publicId}/images`, {
    method: "POST",
        body: fd,
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function startHumanPregradeCheckout(publicId: string): Promise<{ url: string }> {
  const res = await apiFetch(`${BASE}/human-pregrades/${publicId}/checkout`, {
    method: "POST",
      });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function submitHumanPregradeOrder(publicId: string) {
  const res = await apiFetch(`${BASE}/human-pregrades/${publicId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ termsAccepted: true }),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function getHumanPregradeReport(publicId: string) {
  const res = await apiFetch(`${BASE}/human-pregrades/${publicId}/report`, {
      });
  if (!res.ok) await fail(res);
  return res.json();
}

export function humanPregradeReportPdfUrl(publicId: string): string {
  return `${BASE}/human-pregrades/${publicId}/report/pdf`;
}

export async function downloadHumanPregradeReportPdf(publicId: string): Promise<void> {
  const res = await apiFetch(humanPregradeReportPdfUrl(publicId), {
        redirect: "follow",
  });
  if (!res.ok) await fail(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expert-review-${publicId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function listAdminHumanPregrades(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await apiFetch(`${BASE}/admin/human-pregrades${q}`);
  if (!res.ok) await fail(res);
  return res.json();
}

export async function getAdminHumanPregrade(id: string) {
  const res = await apiFetch(`${BASE}/admin/human-pregrades/${id}`);
  if (!res.ok) await fail(res);
  return res.json();
}

export async function assignHumanPregrade(id: string, reviewerUserId: string) {
  const res = await apiFetch(`${BASE}/admin/human-pregrades/${id}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewerUserId }),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function startHumanPregradeReview(id: string) {
  const res = await apiFetch(`${BASE}/admin/human-pregrades/${id}/start`, {
    method: "POST",
      });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function requestHumanPregradeImages(
  id: string,
  body: { instructions: string; requiredImageType: string }
) {
  const res = await apiFetch(`${BASE}/admin/human-pregrades/${id}/request-images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function saveHumanPregradeAssessment(id: string, body: Record<string, unknown>) {
  const res = await apiFetch(`${BASE}/admin/human-pregrades/${id}/assessment`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function saveHumanPregradePredictions(
  id: string,
  predictions: Record<string, unknown>[]
) {
  const res = await apiFetch(`${BASE}/admin/human-pregrades/${id}/grader-predictions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ predictions }),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function addHumanPregradeDefect(id: string, body: Record<string, unknown>) {
  const res = await apiFetch(`${BASE}/admin/human-pregrades/${id}/defects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function submitHumanPregradeForCheck(id: string) {
  const res = await apiFetch(`${BASE}/admin/human-pregrades/${id}/submit-for-check`, {
    method: "POST",
      });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function returnHumanPregradeToReviewer(id: string, note?: string) {
  const res = await apiFetch(`${BASE}/admin/human-pregrades/${id}/return`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function approveHumanPregrade(id: string) {
  const res = await apiFetch(`${BASE}/admin/human-pregrades/${id}/approve`, {
    method: "POST",
      });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function getHumanPregradeReportPreview(id: string) {
  const res = await apiFetch(`${BASE}/admin/human-pregrades/${id}/report-preview`, {
      });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function getAdminHumanPregradeSettings() {
  const res = await apiFetch(`${BASE}/admin/human-pregrades/settings`, {
      });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function updateAdminHumanPregradeSettings(body: Record<string, unknown>) {
  const res = await apiFetch(`${BASE}/admin/human-pregrades/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  return res.json();
}
