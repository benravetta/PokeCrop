import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import {
  gradeCard,
  isGradingConfigured,
  type GradeImageInput,
  type MeasuredCentering,
} from "./grading.js";
import {
  getGradeQuota,
  incrementGrade,
  consumeGradeCredit,
  type GradeQuota,
} from "./gradeQuota.js";
import { isAdminRole, type UserRole } from "./adminAccess.js";
import { isSuspended } from "./usage.js";
import { logActivity } from "./activity.js";
import { logUsageEventAwait, type UsageSource } from "./usageEvents.js";
import { assessCaptureQuality, type CaptureImageInput } from "./captureQuality.js";
import { sendToPython, transcodeViaPython } from "../services/pythonBridge.js";
import { validateParams } from "./cropParams.js";
import { sanitizeBorderSide } from "./centeringInput.js";

export type FileMap = Record<string, Express.Multer.File[]>;

const VISION_READY = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function isHeic(file: Express.Multer.File): boolean {
  const ext = path.extname(file.originalname || "").toLowerCase();
  return (
    file.mimetype === "image/heic" ||
    file.mimetype === "image/heif" ||
    ext === ".heic" ||
    ext === ".heif"
  );
}

export async function fileToVisionDataUrl(file: Express.Multer.File): Promise<string> {
  if (VISION_READY.has(file.mimetype) && !isHeic(file)) {
    return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  }
  const jpeg = await transcodeViaPython(file.buffer, file.originalname || "image");
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

async function toVisionBuffer(
  file: Express.Multer.File
): Promise<{ buffer: Buffer; mime: string }> {
  if (VISION_READY.has(file.mimetype) && !isHeic(file)) {
    return { buffer: file.buffer, mime: file.mimetype };
  }
  const jpeg = await transcodeViaPython(file.buffer, file.originalname || "image");
  return { buffer: jpeg, mime: "image/jpeg" };
}

export function parseCentering(raw: unknown): MeasuredCentering | undefined {
  let v: unknown;
  if (typeof raw === "string") {
    if (!raw.trim() || raw.length > 16_000) return undefined;
    try {
      v = JSON.parse(raw);
    } catch {
      return undefined;
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    v = raw;
  } else {
    return undefined;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  try {
    const parsed = v as MeasuredCentering;
    const ratio = (s: unknown) =>
      typeof s === "string" && /^\d{1,3}\/\d{1,3}$/.test(s) ? s : undefined;
    const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
    const num = (n: unknown) =>
      typeof n === "number" && Number.isFinite(n) ? clamp01(n) : undefined;
    const out: MeasuredCentering = {};
    if (parsed.front && typeof parsed.front === "object")
      out.front = {
        leftRight: ratio(parsed.front.leftRight),
        topBottom: ratio(parsed.front.topBottom),
      };
    if (parsed.back && typeof parsed.back === "object")
      out.back = {
        leftRight: ratio(parsed.back.leftRight),
        topBottom: ratio(parsed.back.topBottom),
      };
    out.front_centering_confidence = num(parsed.front_centering_confidence);
    out.back_centering_confidence = num(parsed.back_centering_confidence);
    out.measurement_confidence = num(parsed.measurement_confidence);
    if (
      parsed.detectionQuality === "good" ||
      parsed.detectionQuality === "fair" ||
      parsed.detectionQuality === "poor"
    ) {
      out.detectionQuality = parsed.detectionQuality;
    }
    out.perspectiveWarning = parsed.perspectiveWarning === true ? true : undefined;
    out.sleeveSuspected = parsed.sleeveSuspected === true ? true : undefined;
    out.lowContrastBorder = parsed.lowContrastBorder === true ? true : undefined;
    out.borderlessDesign = parsed.borderlessDesign === true ? true : undefined;
    out.userAdjustmentDelta =
      typeof parsed.userAdjustmentDelta === "number" && Number.isFinite(parsed.userAdjustmentDelta)
        ? Math.max(0, Math.min(1, parsed.userAdjustmentDelta))
        : undefined;
    out.imageResolution =
      typeof parsed.imageResolution === "number" && Number.isFinite(parsed.imageResolution)
        ? Math.max(0, Math.min(20_000, parsed.imageResolution))
        : undefined;
    out.printSheetVisible = parsed.printSheetVisible === true ? true : undefined;
    if (
      parsed.borderWidths &&
      typeof parsed.borderWidths === "object" &&
      !Array.isArray(parsed.borderWidths)
    ) {
      const bw = parsed.borderWidths as Record<string, unknown>;
      const front = sanitizeBorderSide(bw.front);
      const back = sanitizeBorderSide(bw.back);
      if (front || back) out.borderWidths = { ...(front ? { front } : {}), ...(back ? { back } : {}) };
    }
    const hasAny =
      out.front?.leftRight || out.front?.topBottom || out.back?.leftRight || out.back?.topBottom;
    return hasAny ? out : undefined;
  } catch {
    return undefined;
  }
}

export function summariseGrade(result: Record<string, unknown>): {
  summary: string;
  detail: Record<string, unknown>;
} {
  const ident =
    result.card_identification && typeof result.card_identification === "object"
      ? (result.card_identification as Record<string, unknown>)
      : {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(ident.name);
  const set = str(ident.set);
  const number = str(ident.number);
  const rec =
    result.submission_recommendation && typeof result.submission_recommendation === "object"
      ? (result.submission_recommendation as Record<string, unknown>)
      : {};
  let likely = "";
  if (Array.isArray(result.company_estimates) && result.company_estimates.length) {
    const c0 = result.company_estimates[0] as Record<string, unknown>;
    likely = `${str(c0.company)} ${str(c0.likely)}`.trim();
  }
  const summaryParts = [name || "Card", number && `#${number}`, set && `(${set})`].filter(
    Boolean
  );
  return {
    summary: summaryParts.join(" "),
    detail: {
      name: name || undefined,
      set: set || undefined,
      number: number || undefined,
      verdict: str(rec.verdict) || undefined,
      likely: likely || undefined,
    },
  };
}

async function captureInputsFromFiles(files: FileMap | undefined): Promise<CaptureImageInput[]> {
  if (!files) return [];
  const out: CaptureImageInput[] = [];
  for (const label of ["front", "back"] as const) {
    const f = files[label]?.[0];
    if (!f) continue;
    try {
      const { buffer, mime } = await toVisionBuffer(f);
      out.push({ label, buffer, mime, originalname: f.originalname });
    } catch (err) {
      console.error(`capture QA: failed to prepare ${label}:`, err);
    }
  }
  return out;
}

export async function toGradeImages(files: FileMap | undefined): Promise<GradeImageInput[]> {
  if (!files) return [];
  const images: GradeImageInput[] = [];
  const add = async (label: GradeImageInput["label"], f?: Express.Multer.File) => {
    if (!f) return;
    try {
      images.push({ label, dataUrl: await fileToVisionDataUrl(f) });
    } catch (err) {
      console.error(`grade: failed to prepare ${label} image:`, err);
    }
  };
  await add("front", files.front?.[0]);
  await add("back", files.back?.[0]);
  await add("angled_front", files.angled_front?.[0]);
  await add("angled_back", files.angled_back?.[0]);
  for (const f of files.closeups ?? []) await add("closeup", f);
  return images;
}

export async function straightenGradeImage(
  file: Express.Multer.File,
  tmpDir: string
): Promise<{ ok: true; png: string } | { ok: false; error: string }> {
  const tempPath = path.join(tmpDir, `${uuid()}-${file.originalname || "card"}`);
  try {
    await fs.promises.writeFile(tempPath, file.buffer);
    const result = await sendToPython(tempPath, file.originalname || "card", {
      ...validateParams({}),
      grading_safe: true,
      full_resolution: true,
    });
    const png = result.result_png ?? result.result_web_png;
    if (result.error || !png) {
      return { ok: false, error: "Could not detect a card to straighten." };
    }
    return { ok: true, png };
  } catch (err) {
    console.error("grade straighten failed:", err);
    return { ok: false, error: "Failed to straighten the image." };
  } finally {
    fs.unlink(tempPath, () => {});
  }
}

export type GradeExecuteError = {
  ok: false;
  status: number;
  code: string;
  message: string;
  quota?: GradeQuota;
  capture_quality?: unknown;
};

export type GradeExecuteSuccess = {
  ok: true;
  result: Record<string, unknown>;
  quota: GradeQuota;
  capture_quality: unknown;
  billed: boolean;
  billing?: "free" | "subscription" | "one_off" | "admin";
};

export type GradeExecuteResult = GradeExecuteSuccess | GradeExecuteError;

export async function executeGrade(opts: {
  userId: string;
  files: FileMap | undefined;
  centering?: MeasuredCentering;
  source: UsageSource;
  actorEmail?: string | null;
  role?: UserRole;
}): Promise<GradeExecuteResult> {
  const { userId, files, centering, source, actorEmail, role } = opts;

  if (!isGradingConfigured()) {
    return {
      ok: false,
      status: 503,
      code: "not_configured",
      message: "AI grading is not configured.",
    };
  }

  const images = await toGradeImages(files);
  if (!images.some((i) => i.label === "front")) {
    return {
      ok: false,
      status: 400,
      code: "invalid_request",
      message: "A front image is required.",
    };
  }

  if (await isSuspended(userId)) {
    return {
      ok: false,
      status: 403,
      code: "forbidden_plan",
      message: "Account suspended.",
    };
  }

  const quota = await getGradeQuota(userId, role);
  if (!isAdminRole(role) && quota.remaining <= 0) {
    return {
      ok: false,
      status: 429,
      code: "quota_exceeded",
      message:
        quota.window === "month"
          ? quota.plan === "free"
            ? `You've used all ${quota.limit} free pre-grade reports for this month.`
            : `You've used all ${quota.limit} pre-grade reports for this month.`
          : "You've reached today's grading limit.",
      quota,
    };
  }

  const centeringMeasured = Boolean(
    centering?.front?.leftRight ||
      centering?.front?.topBottom ||
      centering?.back?.leftRight ||
      centering?.back?.topBottom
  );

  const captureQA = await assessCaptureQuality(
    await captureInputsFromFiles(files),
    userId,
    { centeringMeasured }
  );
  if (!captureQA.ok) {
    const blockMsg = captureQA.issues
      .filter((i) => i.severity === "block")
      .map((i) => i.message)
      .join(" ");
    return {
      ok: false,
      status: 422,
      code: "capture_quality",
      message: blockMsg || "Photo quality is too low for a reliable grade.",
      capture_quality: captureQA,
    };
  }

  const result = await gradeCard(images, userId, centering);
  if (!result) {
    return {
      ok: false,
      status: 502,
      code: "processing_failed",
      message: "Grading failed. Please try again.",
    };
  }

  const resultRec = result as Record<string, unknown>;

  if (resultRec.not_a_card === true) {
    logActivity({
      userId,
      action: source === "api" ? "grade.api.not_a_card" : "grade.web.not_a_card",
      actorId: userId,
      actorEmail: actorEmail ?? null,
      detail: { images: images.length },
    });
    return {
      ok: true,
      result: { ...resultRec, capture_quality: captureQA },
      quota,
      capture_quality: captureQA,
      billed: false,
    };
  }

  resultRec.capture_quality = captureQA;

  const { summary, detail } = summariseGrade(resultRec);
  let billing: "free" | "subscription" | "one_off" | "admin";
  let usedAfter: number | null = null;
  let remainingAfter: number | null = null;

  if (isAdminRole(role)) {
    billing = "admin";
    remainingAfter = null;
  } else if (quota.allowanceRemaining > 0) {
    const newCount = await incrementGrade(userId);
    billing = quota.plan === "free" ? "free" : "subscription";
    usedAfter = newCount;
    remainingAfter = Math.max(0, quota.limit - newCount) + quota.credits;
  } else {
    const creditsLeft = await consumeGradeCredit(userId);
    billing = "one_off";
    usedAfter = quota.limit;
    remainingAfter = creditsLeft >= 0 ? creditsLeft : 0;
  }

  logActivity({
    userId,
    action: source === "api" ? "grade.api" : "grade.web",
    actorId: userId,
    actorEmail: actorEmail ?? null,
    detail: {
      images: images.length,
      back: images.some((i) => i.label === "back"),
      centering: Boolean(centering),
      billing,
    },
  });

  const eventId = await logUsageEventAwait({
    userId,
    kind: "grade",
    source,
    billing,
    plan: quota.plan,
    window: quota.window,
    usedAfter,
    remainingAfter,
    summary,
    detail,
  }).catch((err) => {
    console.error("logUsageEventAwait failed:", err);
    return null;
  });

  if (eventId) {
    try {
      const { persistGradeArtifacts, patchGradeArtifacts } = await import("./gradeArtifacts.js");
      const artifacts = await persistGradeArtifacts({
        userId,
        eventId,
        result: resultRec,
        files,
        plan: quota.plan,
        billing,
        role,
      });
      if (artifacts) {
        await patchGradeArtifacts(eventId, userId, artifacts, detail);
      }
    } catch (err) {
      console.error("grade artifact persistence failed:", err);
    }
  }

  const updated = await getGradeQuota(userId, role);
  return {
    ok: true,
    result: resultRec,
    quota: updated,
    capture_quality: captureQA,
    billed: true,
    billing,
  };
}
