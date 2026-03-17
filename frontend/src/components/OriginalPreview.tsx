import { useAppStore } from "../hooks/useProcessing";
import { Image as ImageIcon } from "lucide-react";

export function OriginalPreview() {
  const { originalBase64, filename } = useAppStore();

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
          <img
            src={`data:image/png;base64,${originalBase64}`}
            alt="Original upload"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <p className="text-text-muted text-sm">No image</p>
        )}
      </div>
    </>
  );
}
