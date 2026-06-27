import { apiFetch } from "../lib/sessionFetch";
import type { CollectorProfileSettings, CollectorSettingsResponse } from "./admin/collectorSettingsTypes";

export type { CollectorProfileSettings, CollectorSettingsResponse } from "./admin/collectorSettingsTypes";

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

export interface CollectorProfilesConfig {
  enabled: boolean;
  messagingEnabled: boolean;
  gradingEnabled: boolean;
  discoveryEnabled: boolean;
  tradeEnquiriesEnabled: boolean;
  supportedCardGames: string[];
  allowViewerGradingDefault: boolean;
  reportReasons?: string[];
}

export interface PublicProfileView {
  profile: {
    username: string;
    displayName: string;
    bio: string | null;
    locationRegion: string | null;
    messagingEnabled?: boolean;
    tradeEnquiriesEnabled?: boolean;
  };
  interests: { interest_type: string; interest_value: string }[];
  links: { label: string; url: string }[];
  showcase: unknown[];
  forTrade: unknown[];
  wanted: unknown[];
  seo: { noIndex: boolean };
}

export async function fetchCollectorProfilesConfigPublic(): Promise<{ enabled: boolean } | null> {
  const res = await fetch(`${BASE}/collector/config/public`, { credentials: "include" });
  if (res.status === 404) return null;
  if (!res.ok) await fail(res);
  return res.json();
}

export async function fetchCollectorProfilesConfig(): Promise<CollectorProfilesConfig | null> {
  const res = await apiFetch(`${BASE}/collector/config`);
  if (res.status === 404) return null;
  if (!res.ok) await fail(res);
  return res.json();
}

export async function fetchPublicProfile(username: string): Promise<PublicProfileView> {
  const res = await fetch(`${BASE}/collector/profiles/${encodeURIComponent(username)}`, {
    credentials: "include",
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function fetchMyCollectorProfile() {
  const res = await apiFetch(`${BASE}/collector/profile/me`);
  if (!res.ok) await fail(res);
  return res.json();
}

export async function createCollectorProfile(body: { username: string; displayName: string }) {
  const res = await apiFetch(`${BASE}/collector/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function updateCollectorProfile(body: Record<string, unknown>) {
  const res = await apiFetch(`${BASE}/collector/profile/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function publishCollectorProfile() {
  const res = await apiFetch(`${BASE}/collector/profile/me/publish`, { method: "POST" });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function listCollectorCards() {
  const res = await apiFetch(`${BASE}/collector/cards`);
  if (!res.ok) await fail(res);
  return res.json();
}

export async function createCollectorCard(body: Record<string, unknown>) {
  const res = await apiFetch(`${BASE}/collector/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function fetchCollectorCard(publicCardId: string) {
  const res = await apiFetch(`${BASE}/collector/cards/${encodeURIComponent(publicCardId)}`);
  if (!res.ok) await fail(res);
  return res.json();
}

export async function patchCollectorCard(publicCardId: string, body: Record<string, unknown>) {
  const res = await apiFetch(`${BASE}/collector/cards/${encodeURIComponent(publicCardId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function identifyCollectorCard(publicCardId: string, role: "front" | "back", force?: boolean) {
  const res = await apiFetch(`${BASE}/collector/cards/${encodeURIComponent(publicCardId)}/identify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, force }),
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export async function publishCollectorCard(publicCardId: string) {
  const res = await apiFetch(`${BASE}/collector/cards/${encodeURIComponent(publicCardId)}/publish`, {
    method: "POST",
  });
  if (!res.ok) await fail(res);
  return res.json();
}

export interface PublicCardView {
  profile: { username: string; displayName: string };
  card: {
    publicId: string;
    cardName: string;
    cardGame?: string | null;
    setName?: string | null;
    setCode?: string | null;
    cardNumber?: string | null;
    releaseYear?: number | null;
    language?: string | null;
    variant?: string | null;
    rarity?: string | null;
    finishType?: string | null;
    edition?: string | null;
    condition?: string | null;
    tradeStatus?: string | null;
    cardState?: string | null;
    officialGrade?: string | null;
    gradingCompany?: string | null;
    certificationNumber?: string | null;
    publicDescription?: string | null;
    tradeValueMinorUnits?: number | null;
    tradeValueCurrency?: string | null;
    identifiers?: string[];
    identificationConfidence?: number | null;
  };
  images: {
    frontDisplayUrl?: string | null;
    backDisplayUrl?: string | null;
    frontThumbUrl?: string | null;
    backThumbUrl?: string | null;
  };
  viewerGradingAllowed?: boolean;
  seo: { noIndex: boolean };
}

export async function listCollectorConversations() {
  const res = await apiFetch(`${BASE}/collector/conversations`);
  if (!res.ok) await fail(res);
  return res.json();
}

export async function listCollectorTradeEnquiries() {
  const res = await apiFetch(`${BASE}/collector/trade-enquiries`);
  if (!res.ok) await fail(res);
  return res.json();
}

export async function fetchPublicCard(username: string, publicCardId: string) {
  const res = await fetch(
    `${BASE}/collector/profiles/${encodeURIComponent(username)}/cards/${encodeURIComponent(publicCardId)}`,
    { credentials: "include" }
  );
  if (!res.ok) await fail(res);
  return res.json();
}

export async function fetchAdminCollectorSettings(): Promise<CollectorSettingsResponse> {
  const res = await apiFetch(`${BASE}/admin/collector/settings`);
  if (!res.ok) await fail(res);
  return res.json();
}

export async function updateAdminCollectorSettings(
  patch: Partial<CollectorProfileSettings>
): Promise<CollectorSettingsResponse> {
  const res = await apiFetch(`${BASE}/admin/collector/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) await fail(res);
  return res.json();
}
