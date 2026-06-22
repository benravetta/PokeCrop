export function mimeFromFilename(name: string | null): string {
  if (!name) return "image/png";
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    case "dng":
      return "image/x-adobe-dng";
    case "pdf":
      return "application/pdf";
    default:
      return "image/png";
  }
}

export function baseName(name: string | null): string {
  if (!name) return "card";
  const stem = name.replace(/\.[^.]+$/, "");
  const safe = stem.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  return safe || "card";
}
