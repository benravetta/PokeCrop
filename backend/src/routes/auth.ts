import { Router, type Request, type Response } from "express";
import { getAuthClient, isSupabaseAuthConfigured } from "../lib/supabase.js";
import { isTurnstileConfigured } from "../lib/turnstile.js";
import {
  clearCsrfCookie,
  clearSessionCookies,
  setCsrfCookie,
  setSessionCookies,
} from "../lib/sessionCookies.js";
import { issueCsrfToken } from "../middleware/csrf.js";
import { roleFromAppMetadata } from "../middleware/auth.js";

export const authRoutes = Router();

function authUnavailable(res: Response): void {
  res.status(503).json({ error: "Authentication is not configured." });
}

function serializeUser(user: {
  id: string;
  email?: string;
  app_metadata?: unknown;
  user_metadata?: unknown;
}) {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: user.id,
    email: user.email ?? null,
    role: roleFromAppMetadata(user.app_metadata),
    displayName: typeof meta.display_name === "string" ? meta.display_name : null,
  };
}

function readCaptchaToken(req: Request): string | undefined {
  if (typeof req.body?.captchaToken === "string" && req.body.captchaToken.trim()) {
    return req.body.captchaToken.trim();
  }
  if (typeof req.body?.turnstileToken === "string" && req.body.turnstileToken.trim()) {
    return req.body.turnstileToken.trim();
  }
  return undefined;
}

/**
 * Turnstile tokens are single-use. Supabase Auth verifies captchaToken itself —
 * calling Cloudflare siteverify here first would consume the token and cause
 * "timeout-or-duplicate" on sign-in.
 */
function requireCaptchaToken(
  req: Request,
  res: Response
): { ok: true; token: string | undefined } | { ok: false } {
  const token = readCaptchaToken(req);
  const captchaRequired =
    isTurnstileConfigured() || process.env.NODE_ENV === "production";
  if (captchaRequired && !token) {
    res.status(400).json({ error: "Complete the security check." });
    return { ok: false };
  }
  return { ok: true, token };
}

authRoutes.get("/auth/csrf", (_req, res) => {
  const token = issueCsrfToken();
  setCsrfCookie(res, token);
  res.json({ token });
});

authRoutes.get("/auth/session", async (req, res) => {
  if (!isSupabaseAuthConfigured()) {
    authUnavailable(res);
    return;
  }
  const access = req.cookies?.gc_access;
  if (typeof access !== "string" || !access) {
    res.json({ user: null });
    return;
  }
  try {
    const { data, error } = await getAuthClient().auth.getUser(access);
    if (error || !data.user) {
      res.json({ user: null });
      return;
    }
    res.json({ user: serializeUser(data.user) });
  } catch {
    res.json({ user: null });
  }
});

authRoutes.post("/auth/login", async (req, res) => {
  if (!isSupabaseAuthConfigured()) {
    authUnavailable(res);
    return;
  }
  const captcha = requireCaptchaToken(req, res);
  if (!captcha.ok) return;

  const email = String(req.body?.email ?? "").trim();
  const password = String(req.body?.password ?? "");
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required." });
    return;
  }

  const { data, error } = await getAuthClient().auth.signInWithPassword({
    email,
    password,
    options: captcha.token ? { captchaToken: captcha.token } : undefined,
  });
  if (error || !data.session) {
    res.status(401).json({ error: error?.message ?? "Invalid credentials." });
    return;
  }

  setSessionCookies(res, data.session.access_token, data.session.refresh_token);
  const csrf = issueCsrfToken();
  setCsrfCookie(res, csrf);
  res.json({ user: serializeUser(data.user), csrfToken: csrf });
});

authRoutes.post("/auth/signup", async (req, res) => {
  if (!isSupabaseAuthConfigured()) {
    authUnavailable(res);
    return;
  }
  const captcha = requireCaptchaToken(req, res);
  if (!captcha.ok) return;

  const email = String(req.body?.email ?? "").trim();
  const password = String(req.body?.password ?? "");
  const displayName =
    typeof req.body?.displayName === "string" ? req.body.displayName.trim() : undefined;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required." });
    return;
  }

  const { data, error } = await getAuthClient().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: process.env.PUBLIC_ORIGIN || "http://localhost:8080",
      data: displayName ? { display_name: displayName } : undefined,
      ...(captcha.token ? { captchaToken: captcha.token } : {}),
    },
  });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (data.session) {
    setSessionCookies(res, data.session.access_token, data.session.refresh_token);
    const csrf = issueCsrfToken();
    setCsrfCookie(res, csrf);
    res.status(201).json({
      user: serializeUser(data.user!),
      needsConfirmation: false,
      csrfToken: csrf,
    });
    return;
  }

  res.status(201).json({ user: null, needsConfirmation: true });
});

authRoutes.post("/auth/logout", async (req, res) => {
  const access = req.cookies?.gc_access;
  if (typeof access === "string" && access && isSupabaseAuthConfigured()) {
    try {
      await getAuthClient().auth.signOut();
    } catch {
      /* ignore */
    }
  }
  clearSessionCookies(res);
  clearCsrfCookie(res);
  res.json({ ok: true });
});

authRoutes.post("/auth/refresh", async (req, res) => {
  if (!isSupabaseAuthConfigured()) {
    authUnavailable(res);
    return;
  }
  const refresh = req.cookies?.gc_refresh;
  if (typeof refresh !== "string" || !refresh) {
    res.status(401).json({ error: "No refresh token." });
    return;
  }
  const { data, error } = await getAuthClient().auth.refreshSession({ refresh_token: refresh });
  if (error || !data.session) {
    clearSessionCookies(res);
    res.status(401).json({ error: "Session expired." });
    return;
  }
  setSessionCookies(res, data.session.access_token, data.session.refresh_token);
  res.json({ user: serializeUser(data.user!) });
});

authRoutes.post("/auth/password-reset", async (req, res) => {
  if (!isSupabaseAuthConfigured()) {
    authUnavailable(res);
    return;
  }
  const captcha = requireCaptchaToken(req, res);
  if (!captcha.ok) return;

  const email = String(req.body?.email ?? "").trim();
  if (!email) {
    res.status(400).json({ error: "Email required." });
    return;
  }
  const origin = process.env.PUBLIC_ORIGIN || "http://localhost:8080";
  const { error } = await getAuthClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
    ...(captcha.token ? { captchaToken: captcha.token } : {}),
  });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
});

authRoutes.post("/auth/password-update", async (req, res) => {
  if (!isSupabaseAuthConfigured()) {
    authUnavailable(res);
    return;
  }
  const access = req.cookies?.gc_access;
  const refresh = req.cookies?.gc_refresh;
  if (typeof access !== "string" || !access || typeof refresh !== "string" || !refresh) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const password = String(req.body?.password ?? "");
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  const client = getAuthClient();
  const { error: sessErr } = await client.auth.setSession({
    access_token: access,
    refresh_token: refresh,
  });
  if (sessErr) {
    res.status(401).json({ error: "Invalid session." });
    return;
  }
  const { error } = await client.auth.updateUser({ password });
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  const { data: sessData } = await client.auth.getSession();
  if (sessData.session) {
    setSessionCookies(
      res,
      sessData.session.access_token,
      sessData.session.refresh_token
    );
  }
  res.json({ ok: true });
});

authRoutes.post("/auth/exchange", async (req, res) => {
  if (!isSupabaseAuthConfigured()) {
    authUnavailable(res);
    return;
  }
  const accessToken = String(req.body?.accessToken ?? "");
  const refreshToken = String(req.body?.refreshToken ?? "");
  if (!accessToken || !refreshToken) {
    res.status(400).json({ error: "Tokens required." });
    return;
  }
  const { data, error } = await getAuthClient().auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !data.session || !data.user) {
    res.status(401).json({ error: error?.message ?? "Invalid tokens." });
    return;
  }
  setSessionCookies(res, data.session.access_token, data.session.refresh_token);
  const csrf = issueCsrfToken();
  setCsrfCookie(res, csrf);
  res.json({ user: serializeUser(data.user), csrfToken: csrf });
});
