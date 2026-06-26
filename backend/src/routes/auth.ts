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
import { authIpRateLimit } from "../middleware/authRateLimit.js";
import { safeAuthError } from "../lib/authErrors.js";
import {
  finalizeBetaAccess,
  isInviteRequired,
  validateInviteToken,
} from "../lib/invites.js";
import { getServiceClient } from "../lib/supabase.js";

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

async function loadFreshUser(userId: string) {
  const { data, error } = await getServiceClient().auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return data.user;
}

async function deleteAuthUser(userId: string): Promise<void> {
  try {
    await getServiceClient().auth.admin.deleteUser(userId);
  } catch (err) {
    console.error("deleteAuthUser failed:", err);
  }
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
  const captchaRequired = isTurnstileConfigured();
  if (captchaRequired && !token) {
    res.status(400).json({ error: "Complete the security check." });
    return { ok: false };
  }
  return { ok: true, token };
}

authRoutes.get("/auth/config", async (_req, res) => {
  res.json({ inviteRequired: await isInviteRequired() });
});

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
    const fresh = await loadFreshUser(data.user.id);
    res.json({ user: serializeUser(fresh ?? data.user) });
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
  if (error || !data.session || !data.user) {
    res.status(401).json({
      error: safeAuthError("login", error?.message, "Invalid email or password."),
    });
    return;
  }

  const inviteToken =
    typeof req.body?.inviteToken === "string" ? req.body.inviteToken.trim() : undefined;
  const beta = await finalizeBetaAccess({
    userId: data.user.id,
    email: data.user.email ?? email,
    inviteToken,
  });
  if (!beta.ok) {
    try {
      await getAuthClient().auth.signOut();
    } catch {
      /* ignore */
    }
    res.status(403).json({ error: beta.error });
    return;
  }

  let session = data.session;
  let user = data.user;
  if (beta.role === "admin") {
    const refreshed = await getAuthClient().auth.refreshSession({
      refresh_token: data.session.refresh_token,
    });
    if (refreshed.data.session) session = refreshed.data.session;
    const fresh = await loadFreshUser(data.user.id);
    if (fresh) user = fresh;
  }

  setSessionCookies(res, session.access_token, session.refresh_token);
  const csrf = issueCsrfToken();
  setCsrfCookie(res, csrf);
  res.json({ user: serializeUser(user), csrfToken: csrf });
});

authRoutes.post(
  "/auth/invite/validate",
  authIpRateLimit("invite_validate"),
  async (req, res) => {
    const token = String(req.body?.token ?? "").trim();
    if (!token) {
      res.status(400).json({ valid: false, error: "Invite token required." });
      return;
    }
    const result = await validateInviteToken(token);
    if (!result.valid) {
      res.json({ valid: false });
      return;
    }
    res.json({ valid: true, emailMasked: result.emailMasked });
  }
);

authRoutes.post("/auth/signup", authIpRateLimit("signup"), async (req, res) => {
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

  const inviteToken =
    typeof req.body?.inviteToken === "string" ? req.body.inviteToken.trim() : "";
  if (await isInviteRequired({ fresh: true })) {
    if (!inviteToken) {
      res.status(403).json({
        error: "Registration is invite-only. Use the link from your invitation email.",
      });
      return;
    }
    const invite = await validateInviteToken(inviteToken);
    if (!invite.valid) {
      res.status(403).json({ error: "This invitation is invalid or has expired." });
      return;
    }
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      res.status(403).json({
        error: "Sign up with the email address that received the invitation.",
      });
      return;
    }
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
    res.status(400).json({
      error: safeAuthError("signup", error.message, "Could not create account."),
    });
    return;
  }

  if (data.user?.id && data.session && (await isInviteRequired({ fresh: true })) && inviteToken) {
    const beta = await finalizeBetaAccess({
      userId: data.user.id,
      email,
      inviteToken,
    });
    if (!beta.ok) {
      await deleteAuthUser(data.user.id);
      res.status(403).json({ error: beta.error });
      return;
    }

    let session = data.session;
    let user = data.user;
    if (beta.role === "admin") {
      const refreshed = await getAuthClient().auth.refreshSession({
        refresh_token: data.session.refresh_token,
      });
      if (refreshed.data.session) session = refreshed.data.session;
      const fresh = await loadFreshUser(data.user.id);
      if (fresh) user = fresh;
    }

    setSessionCookies(res, session.access_token, session.refresh_token);
    const csrf = issueCsrfToken();
    setCsrfCookie(res, csrf);
    res.status(201).json({
      user: serializeUser(user),
      needsConfirmation: false,
      csrfToken: csrf,
    });
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
  const fresh = data.user ? await loadFreshUser(data.user.id) : null;
  res.json({ user: serializeUser(fresh ?? data.user!) });
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
    // Always respond OK to avoid email enumeration.
    console.warn("[auth] password-reset:", error.message);
    res.json({ ok: true });
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
    res.status(400).json({
      error: safeAuthError("password-update", error.message, "Could not update password."),
    });
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
    res.status(401).json({
      error: safeAuthError("exchange", error?.message, "Invalid tokens."),
    });
    return;
  }
  setSessionCookies(res, data.session.access_token, data.session.refresh_token);
  const csrf = issueCsrfToken();
  setCsrfCookie(res, csrf);
  const fresh = await loadFreshUser(data.user.id);
  res.json({ user: serializeUser(fresh ?? data.user), csrfToken: csrf });
});
