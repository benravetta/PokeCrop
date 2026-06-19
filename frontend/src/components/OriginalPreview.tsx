import { useAppStore } from "../hooks/useProcessing";
import { Image as ImageIcon } from "lucide-react";

function mimeFromFilename(name: string | null): string {
  if (!name) return "image/png";
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    default:
      return "image/png";
  }
}

export function OriginalPreview() {
  const { originalBase64, filename } = useAppStore();
  const mime = mimeFromFilename(filename);
  const isPdf = mime === "application/pdf";

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon className="w-4 h-4 text-text-muted" />
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Original
        </h3>
        {filename && (
          <span className="text-xs text-text-muted ml-auto truncate max-w-[140px]">
            {filename}
          </span>
        )}
      </div>
      <div className="flex-1 rounded-xl bg-surface-overlay flex items-center justify-center overflow-hidden min-h-[200px]">
        {originalBase64 ? (
          isPdf ? (
            <object
              data={`data:${mime};base64,${originalBase64}#toolbar=0&navpanes=0&scrollbar=0`}
              type="application/pdf"
              className="w-full h-full min-h-[320px]"
            >
              <p className="text-text-muted text-sm px-4 text-center">
                PDF preview could not be rendered in-browser.
              </p>
            </object>
          ) : (
            <img
              src={`data:${mime};base64,${originalBase64}`}
              alt="Original upload"
              className="max-w-full max-h-full object-contain"
            />
          )
        ) : (
          <p className="text-text-muted text-sm">No image</p>
        )}
      </div>
    </>
  );
}
