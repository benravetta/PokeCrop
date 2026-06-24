import { Router, Request, Response } from "express";
import { verifyTurnstileToken } from "../lib/turnstile.js";
import { getServiceClient, isSupabaseConfigured } from "../lib/supabase.js";

const router = Router();

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim();
  return req.socket.remoteAddress;
}

function trimField(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

async function verifyForm(req: Request, res: Response): Promise<boolean> {
  const token =
    typeof req.body?.turnstileToken === "string" ? req.body.turnstileToken : undefined;
  const result = await verifyTurnstileToken(token, clientIp(req));
  if (result.ok === false) {
    res.status(400).json({ error: result.message });
    return false;
  }
  return true;
}

async function storeSubmission(
  kind: "contact" | "trade",
  name: string,
  email: string,
  payload: Record<string, string>
): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.info(`[form:${kind}]`, { name, email, ...payload });
    return;
  }

  const sb = getServiceClient();
  const { error } = await sb.from("form_submissions").insert({
    kind,
    name,
    email,
    payload,
  });

  if (error) {
    console.error(`Failed to store ${kind} submission:`, error);
    throw error;
  }
}

router.post("/forms/contact", async (req: Request, res: Response) => {
  if (!(await verifyForm(req, res))) return;

  const name = trimField(req.body?.name, 120);
  const email = trimField(req.body?.email, 254);
  const message = trimField(req.body?.message, 4000);

  if (!name || !email || !message || !isEmail(email)) {
    res.status(400).json({ error: "Please fill in all fields correctly." });
    return;
  }

  try {
    await storeSubmission("contact", name, email, { message });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Could not send message. Please try again." });
  }
});

router.post("/forms/trade", async (req: Request, res: Response) => {
  if (!(await verifyForm(req, res))) return;

  const name = trimField(req.body?.name, 120);
  const email = trimField(req.body?.email, 254);
  const businessType = trimField(req.body?.businessType, 200);
  const monthlyVolume = trimField(req.body?.monthlyVolume, 200);

  if (!name || !email || !businessType || !monthlyVolume || !isEmail(email)) {
    res.status(400).json({ error: "Please fill in all fields correctly." });
    return;
  }

  try {
    await storeSubmission("trade", name, email, { businessType, monthlyVolume });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Could not send enquiry. Please try again." });
  }
});

export const formsRoutes = router;
