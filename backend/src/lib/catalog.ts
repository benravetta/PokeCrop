import crypto from "crypto";
import { getServiceClient } from "./supabase.js";
import { isR2Configured, putObject } from "./r2.js";
import { identifyCardAI, isAiIdentifyConfigured } from "./identify.js";
import type { CentringPayload } from "./centringPayload.js";

// Best-effort identity for a card (any field may be null/absent).
export interface CardIdentity {
  tcg?: string | null;
  set?: string | null;
  number?: string | null;
  name?: string | null;
  confidence?: number | null;
}

// Sanitise a taxonomy value into a safe, lowercase path segment.
export function seg(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const s = v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || fallback;
}

export interface CatalogKey {
  key: string;
  tcg: string;
  set: string;
  number: string;
}

export function buildCatalogKey(id: CardIdentity, hash12: string): CatalogKey {
  const tcg = seg(id.tcg, "unidentified");
  const set = seg(id.set, "unknown");
  const number = seg(id.number, "unknown");
  return { key: `catalog/${tcg}/${set}/${number}/${hash12}.png`, tcg, set, number };
}

export interface ArchiveOpts {
  png: Buffer;
  // Optional baseline identity (e.g. from the pipeline); AI may refine it.
  identity?: CardIdentity;
  // Small downscaled JPEG used for AI identification (cheaper than the full PNG).
  idImage?: Buffer;
  source: "web" | "api";
  width?: number;
  height?: number;
  pipelineConfidence?: number | null;
  metadata?: Record<string, unknown>;
  centring?: CentringPayload | null;
}

// Archive a full-resolution PNG crop to R2 and index it in catalog_items,
// de-duplicated by content hash. No-op when R2 is not configured. The index row
// stores no user identity (the catalog is anonymous by design).
//
// Identification (the paid AI call) runs only AFTER the dedupe check, so we
// never pay to re-identify a crop we already have.
export async function archiveCrop(opts: ArchiveOpts): Promise<void> {
  if (!isR2Configured()) return;

  const fullHash = crypto.createHash("sha256").update(opts.png).digest("hex");
  const sb = getServiceClient();

  // Dedupe: identical image already catalogued → nothing to do.
  const { data: existing } = await sb
    .from("catalog_items")
    .select("id")
    .eq("content_hash", fullHash)
    .maybeSingle();
  if (existing) return;

  // Resolve identity: prefer AI (on the small id image), fall back to whatever
  // baseline identity was supplied.
  let identity: CardIdentity = opts.identity ?? {};
  if (isAiIdentifyConfigured()) {
    const ai = await identifyCardAI(opts.idImage ?? opts.png);
    if (ai) identity = ai;
  }

  const { key, tcg, set, number } = buildCatalogKey(identity, fullHash.slice(0, 12));
  await putObject(key, opts.png, "image/png");

  const confidence =
    typeof identity.confidence === "number" ? identity.confidence : null;
  const name =
    typeof identity.name === "string" && identity.name.trim() ? identity.name.trim() : null;
  const { error } = await sb.from("catalog_items").insert({
    content_hash: fullHash,
    r2_key: key,
    tcg,
    card_set: set,
    number,
    name,
    confidence,
    pipeline_confidence: opts.pipelineConfidence ?? null,
    metadata: opts.metadata ?? {},
    centring: opts.centring ?? null,
    source: opts.source,
    width: opts.width ?? null,
    height: opts.height ?? null,
  });
  // Ignore unique-violation races (a concurrent request stored it first).
  if (error && (error as { code?: string }).code !== "23505") throw error;
}

// Fire-and-forget wrapper: archiving must never delay or fail a crop response.
export function archiveCropAsync(opts: ArchiveOpts): void {
  archiveCrop(opts).catch((err) => console.error("archiveCrop failed:", err));
}

// Read width/height from a PNG IHDR chunk without decoding the image.
export function pngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
