import { zipSync } from "fflate";
import { putObject, isR2Configured } from "./r2.js";
import { buildGradeReportPdfBuffer, type GradeReportImages } from "./gradeReportPdf.js";
import { applyCropWatermark } from "./cropWatermark.js";
import { shouldWatermarkFreeExports } from "./pdfWatermark.js";
import { loadReportImage } from "./gradeReportPdfImages.js";
import { getServiceClient } from "./supabase.js";
import type { FileMap } from "./gradeService.js";

export interface GradeArtifactKeys {
  pdfKey: string;
  zipKey: string;
  frontKey?: string;
  backKey?: string;
}

async function toPngBuffer(
  file: Express.Multer.File | undefined
): Promise<Buffer | null> {
  if (!file?.buffer?.length) return null;
  const img = await loadReportImage(file.buffer, file.originalname);
  if (!img) return file.buffer;
  return Buffer.from(await img.getBuffer("image/png"));
}

export async function persistGradeArtifacts(opts: {
  userId: string;
  eventId: number;
  result: Record<string, unknown>;
  files: FileMap | undefined;
  plan?: import("./plans.js").Plan | null;
  billing?: import("./usageEvents.js").UsageBilling | null;
  role?: import("./adminAccess.js").UserRole;
}): Promise<GradeArtifactKeys | null> {
  if (!isR2Configured()) return null;

  const prefix = `users/${opts.userId}/grades/${opts.eventId}`;
  const frontBuf = await toPngBuffer(opts.files?.front?.[0]);
  const backBuf = await toPngBuffer(opts.files?.back?.[0]);
  if (!frontBuf) return null;

  const reportImages: GradeReportImages = {
    front: frontBuf,
    back: backBuf ?? undefined,
    frontName: opts.files?.front?.[0]?.originalname,
    backName: opts.files?.back?.[0]?.originalname,
  };

  const watermark = shouldWatermarkFreeExports({
    role: opts.role,
    plan: opts.plan,
    billing: opts.billing,
  });

  const { buffer: pdfBuf, filename: pdfName } = await buildGradeReportPdfBuffer(
    opts.result,
    reportImages,
    { watermark }
  );

  const storedFront = watermark ? await applyCropWatermark(frontBuf) : frontBuf;
  const storedBack = backBuf ? (watermark ? await applyCropWatermark(backBuf) : backBuf) : undefined;

  const frontKey = `${prefix}/front.png`;
  const backKey = storedBack ? `${prefix}/back.png` : undefined;
  const pdfKey = `${prefix}/${pdfName.replace(/[^\w.-]+/g, "_") || "report.pdf"}`;
  const zipKey = `${prefix}/bundle.zip`;

  await putObject(frontKey, storedFront, "image/png");
  if (storedBack && backKey) await putObject(backKey, storedBack, "image/png");
  await putObject(pdfKey, pdfBuf, "application/pdf");

  const zipEntries: Record<string, Uint8Array> = {
    [pdfName.endsWith(".pdf") ? pdfName : "report.pdf"]: pdfBuf,
    "front.png": storedFront,
  };
  if (storedBack) zipEntries["back.png"] = storedBack;
  const zipBuf = Buffer.from(zipSync(zipEntries));
  await putObject(zipKey, zipBuf, "application/zip");

  return { pdfKey, zipKey, frontKey, backKey };
}

export async function patchGradeArtifacts(
  eventId: number,
  userId: number | string,
  artifacts: GradeArtifactKeys,
  existingDetail: Record<string, unknown> | null | undefined
): Promise<void> {
  const detail = { ...(existingDetail ?? {}), artifacts };
  const { error } = await getServiceClient()
    .from("usage_events")
    .update({ detail })
    .eq("id", eventId)
    .eq("user_id", userId);
  if (error) console.error("patchGradeArtifacts failed:", error);
}

export function artifactKeyFromDetail(
  detail: Record<string, unknown> | null | undefined,
  type: "pdf" | "zip"
): string | null {
  const artifacts = detail?.artifacts;
  if (!artifacts || typeof artifacts !== "object") return null;
  const rec = artifacts as Record<string, unknown>;
  const key = type === "pdf" ? rec.pdfKey : rec.zipKey;
  return typeof key === "string" && key.trim() ? key : null;
}

export function isOwnedArtifactKey(key: string, userId: string): boolean {
  const prefix = `users/${userId}/grades/`;
  if (!key.startsWith(prefix)) return false;
  if (key.includes("..") || key.includes("\\")) return false;
  return true;
}
