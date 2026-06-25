import type { Request, Response, NextFunction } from "express";

const WINDOW_MS = 60_000;
const buckets = new Map<string, { start: number; count: number }>();

const LIMITS: Record<string, number> = {
  create: 10,
  upload: 30,
  checkout: 10,
  message: 20,
};

function key(userId: string, action: string): string {
  return `${userId}:${action}`;
}

function check(userId: string, action: string, limit: number): boolean {
  const now = Date.now();
  const k = key(userId, action);
  let b = buckets.get(k);
  if (!b || now - b.start >= WINDOW_MS) {
    b = { start: now, count: 0 };
    buckets.set(k, b);
  }
  b.count += 1;
  return b.count <= limit;
}

export function humanPregradeRateLimit(action: keyof typeof LIMITS) {
  const limit = LIMITS[action] ?? 30;
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.id;
    if (!userId) {
      next();
      return;
    }
    if (!check(userId, action, limit)) {
      res.status(429).json({ error: "Too many requests. Please try again shortly." });
      return;
    }
    next();
  };
}
