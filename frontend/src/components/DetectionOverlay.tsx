import { useAppStore } from "../hooks/useProcessing";
import { ScanSearch } from "lucide-react";

export function DetectionOverlay() {
  const { overlayBase64, metadata, error } = useAppStore();

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <ScanSearch className="w-4 h-4 text-text-muted" />
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Detection
        </h3>
        {metadata && (
          <span className="text-xs text-text-muted ml-auto">
            {metadata.candidates_found} candidate{metadata.candidates_found !== 1 ? "s" : ""} &middot;{" "}
            {(metadata.confidence * 100).toFixed(0)}% conf &middot;{" "}
            {metadata.pipeline_time_ms}ms
          </span>
        )}
      </div>
      <div className="flex-1 rounded-xl bg-surface-overlay flex items-center justify-center overflow-hidden min-h-[200px]">
        {error && !overlayBase64 ? (
          <div className="p-6 text-center">
            <p className="text-error text-sm">{error}</p>
          </div>
        ) : overlayBase64 ? (
          <img
            src={`data:image/png;base64,${overlayBase64}`}
            alt="Detection overlay"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <p className="text-text-muted text-sm">Waiting for processing...</p>
        )}
      </div>
    </>
  );
}
