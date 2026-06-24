import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import { processRoutes } from "./routes/process.js";
import { meRoutes } from "./routes/me.js";
import { billingRoutes, stripeWebhookHandler } from "./routes/billing.js";
import { adminRoutes } from "./routes/admin.js";
import { keyRoutes } from "./routes/keys.js";
import { gradeRoutes } from "./routes/grade.js";
import { apiV1Routes } from "./routes/v1.js";
import { formsRoutes } from "./routes/forms.js";
import { sendApiError } from "./lib/apiError.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// Web app + account/billing/admin API: locked-down CORS.
const webCors = cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
});
// Public API (/v1): open CORS so machine clients on any origin can call it.
const apiCors = cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "X-API-Key", "Accept", "Idempotency-Key"],
  maxAge: 86400,
});

// Stripe webhook must read the raw request body to verify the signature, so it
// is mounted before the JSON body parser.
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

// Public API: open CORS + larger JSON limit (base64 images). Mounted before the
// global 1mb parser; once it parses a /v1 body the global parser is a no-op.
app.use("/v1", apiCors, express.json({ limit: "55mb" }));

app.use("/api", webCors);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", meRoutes);
app.use("/api", billingRoutes);
app.use("/api", adminRoutes);
app.use("/api", keyRoutes);
app.use("/api", gradeRoutes);
app.use("/api", processRoutes);
app.use("/api", formsRoutes);
app.use("/v1", apiV1Routes);

// API-shaped error handler for /v1 (multer/body-parser errors become the
// structured { error: { code, message } } envelope).
app.use(
  "/v1",
  (
    err: Error & { code?: string; type?: string },
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    if (err instanceof multer.MulterError) {
      sendApiError(
        res,
        err.code === "LIMIT_FILE_SIZE" ? "payload_too_large" : "invalid_request",
        err.message
      );
      return;
    }
    if (err.type === "entity.too.large") {
      sendApiError(res, "payload_too_large", "Request body too large.");
      return;
    }
    if (typeof err.message === "string" && err.message.startsWith("Unsupported file type")) {
      sendApiError(res, "unsupported_media_type", err.message);
      return;
    }
    console.error("v1 error:", err);
    sendApiError(res, "internal_error", "Unexpected error.");
  }
);

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
  console.log(`GemCheck backend running on http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  // tsx watch sends SIGTERM on reload; exit promptly so the dev server can restart.
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
