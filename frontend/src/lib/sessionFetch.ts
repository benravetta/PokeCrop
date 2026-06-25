const BASE = "/api";

let csrfToken: string | null = null;
let csrfPromise: Promise<void> | null = null;

export async function ensureCsrf(): Promise<void> {
  if (csrfToken) return;
  if (csrfPromise) return csrfPromise;
  csrfPromise = (async () => {
    const res = await fetch(`${BASE}/auth/csrf`, { credentials: "include" });
    if (!res.ok) throw new Error("Could not initialize session security.");
    const data = (await res.json()) as { token?: string };
    csrfToken = data.token ?? null;
  })();
  try {
    await csrfPromise;
  } finally {
    csrfPromise = null;
  }
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}

const CSRF_EXEMPT_PATHS = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/password-reset",
  "/api/auth/exchange",
];

function needsCsrf(input: RequestInfo | URL, method: string): boolean {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  const raw = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  return !CSRF_EXEMPT_PATHS.some((p) => raw.includes(p));
}

/** Cookie-authenticated fetch with CSRF on mutating requests. */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (needsCsrf(input, method)) {
    await ensureCsrf();
    if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  }
  return fetch(input, { ...init, credentials: "include", headers });
}

export async function exchangeHashSession(): Promise<boolean> {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return false;

  const res = await fetch(`${BASE}/auth/exchange`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, refreshToken }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { csrfToken?: string };
  if (data.csrfToken) setCsrfToken(data.csrfToken);
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
}
