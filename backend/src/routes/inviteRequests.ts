import { Router, type Request, type Response } from "express";
import { verifyTurnstileToken } from "../lib/turnstile.js";
import { authIpRateLimit } from "../middleware/authRateLimit.js";
import { createInviteRequest } from "../lib/inviteRequests.js";
import { isInviteRequired } from "../lib/appSettings.js";

export const inviteRequestRoutes = Router();

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim();
  return req.socket.remoteAddress;
}

inviteRequestRoutes.get("/invite-requests/enabled", async (_req, res) => {
  res.json({ enabled: await isInviteRequired() });
});

inviteRequestRoutes.post(
  "/invite-requests",
  authIpRateLimit("signup"),
  async (req: Request, res: Response) => {
    if (!(await isInviteRequired())) {
      res.status(403).json({
        error: "Public registration is open — you can create an account directly.",
      });
      return;
    }

    const token =
      typeof req.body?.turnstileToken === "string" ? req.body.turnstileToken : undefined;
    const captcha = await verifyTurnstileToken(token, clientIp(req));
    if (captcha.ok === false) {
      res.status(400).json({ error: captcha.message });
      return;
    }

    const email = String(req.body?.email ?? "").trim();
    const name = typeof req.body?.name === "string" ? req.body.name : undefined;
    const message = typeof req.body?.message === "string" ? req.body.message : undefined;

    try {
      await createInviteRequest({ email, name, message });
      res.status(201).json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not submit request.";
      const status = msg.includes("already pending") ? 409 : 400;
      res.status(status).json({ error: msg });
    }
  }
);
