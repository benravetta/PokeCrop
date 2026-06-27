import type { Express } from "express";
import { executeGrade, type FileMap } from "../../lib/gradeService.js";
import type { UserRole } from "../../lib/adminAccess.js";
import { CollectorProfileError } from "../domain/types.js";

export function bufferToMulterFile(opts: {
  buffer: Buffer;
  fieldname: string;
  originalname: string;
  mimetype: string;
}): Express.Multer.File {
  return {
    fieldname: opts.fieldname,
    originalname: opts.originalname,
    encoding: "7bit",
    mimetype: opts.mimetype,
    size: opts.buffer.length,
    buffer: opts.buffer,
    stream: undefined as never,
    destination: "",
    filename: opts.originalname,
    path: "",
  };
}

export async function gradeFromBuffers(opts: {
  userId: string;
  role?: UserRole;
  actorEmail?: string | null;
  front: Buffer;
  back?: Buffer;
  frontMime?: string;
  backMime?: string;
}) {
  const files: FileMap = {
    front: [
      bufferToMulterFile({
        buffer: opts.front,
        fieldname: "front",
        originalname: "front.jpg",
        mimetype: opts.frontMime ?? "image/jpeg",
      }),
    ],
  };
  if (opts.back) {
    files.back = [
      bufferToMulterFile({
        buffer: opts.back,
        fieldname: "back",
        originalname: "back.jpg",
        mimetype: opts.backMime ?? "image/jpeg",
      }),
    ];
  }
  const result = await executeGrade({
    userId: opts.userId,
    files,
    source: "web",
    actorEmail: opts.actorEmail,
    role: opts.role,
  });
  if (!result.ok) {
    throw new CollectorProfileError(
      result.code === "capture_quality" ? "COLLECTOR_INVALID_INPUT" : "COLLECTOR_GRADING_UNAVAILABLE",
      result.message,
      result.status
    );
  }
  return result;
}
