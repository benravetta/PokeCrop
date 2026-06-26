import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/** Resolve bundled/static asset paths in dev and production (esbuild bundle). */
export function resolveAsset(filename: string): string {
  const base = path.basename(filename);
  const candidates = [
    path.join(process.cwd(), "assets", base),
    path.join("/app/backend/assets", base),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../assets", base),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "assets", base),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}
