import { useAppStore } from "../hooks/useProcessing";
import { Sparkles } from "lucide-react";

export function ResultPreview() {
  const { resultBase64, metadata } = useAppStore();

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-text-muted" />
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Result
        </h3>
        {metadata && (
          <span className="text-xs text-text-muted ml-auto">
            r={metadata.estimated_corner_radius_px}px
            {metadata.rotation_deg !== 0 &&
              ` · ${metadata.rotation_deg > 0 ? "+" : ""}${metadata.rotation_deg}°`}
          </span>
        )}
      </div>
      <div className="flex-1 rounded-xl checkerboard flex items-center justify-center overflow-hidden min-h-[200px]">
        {resultBase64 ? (
          <img
            src={`data:image/png;base64,${resultBase64}`}
            alt="Extracted card"
            className="max-w-full max-h-full object-contain drop-shadow-2xl"
          />
        ) : (
          <p className="text-text-muted text-sm">No result yet</p>
        )}
      </div>
    </>
  );
}
