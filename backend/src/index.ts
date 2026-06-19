import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import { processRoutes } from "./routes/process.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

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
  console.log(`PokeCrop backend running on http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  // tsx watch sends SIGTERM on reload; exit promptly so the dev server can restart.
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
