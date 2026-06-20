import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import { processRoutes } from "./routes/process.js";
import { meRoutes } from "./routes/me.js";
import { billingRoutes, stripeWebhookHandler } from "./routes/billing.js";
import { adminRoutes } from "./routes/admin.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  })
);

// Stripe webhook must read the raw request body to verify the signature, so it
// is mounted before the JSON body parser.
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", meRoutes);
app.use("/api", billingRoutes);
app.use("/api", adminRoutes);
app.use("/api", processRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err.message?.startsWith("Unsupported file type")) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(PORT, () => {
  console.log(`CardCrop backend running on http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  // tsx watch sends SIGTERM on reload; exit promptly so the dev server can restart.
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
