import { useState } from "react";
import { Crop, SlidersHorizontal, ArrowLeft, Check, RotateCcw, X } from "lucide-react";
import { ResultStage } from "./ResultStage";
import { CropPanel } from "./CropPanel";
import { ProcessingStage } from "./ProcessingStage";
import { AdvancedDrawer } from "./AdvancedDrawer";
import { ExportControls } from "./ExportControls";
import { useAppStore, paramsDiffer } from "../hooks/useProcessing";

type Mode = "view" | "crop";

export function Workspace() {
  const {
    processing,
    uploading,
    cropDirty,
    params,
    appliedParams,
    resultBase64,
    metadata,
    error,
    process,
    resetCrop,
    revertCrop,
    reset,
  } = useAppStore();

  const [mode, setMode] = useState<Mode>("view");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const busy = processing || uploading;
  const dirty = cropDirty || paramsDiffer(params, appliedParams);

  const applyChanges = async () => {
    setDrawerOpen(false);
    await process();
    setMode("view");
  };

  const enterCrop = () => {
    setDrawerOpen(false);
    setMode("crop");
  };

  const cancelCrop = () => {
    revertCrop();
    setMode("view");
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Stage header */}
      <div className="flex items-center gap-3 px-4 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3">
        <h2 className="text-sm font-semibold text-text-primary">
          {mode === "crop" ? "Adjust the crop" : "Your card"}
        </h2>
        {mode === "view" && metadata && !busy && (
          <span className="text-[11px] text-text-muted">
            {metadata.rotation_deg !== 0 &&
              `straightened ${metadata.rotation_deg > 0 ? "+" : ""}${metadata.rotation_deg}° · `}
            {(metadata.pipeline_time_ms / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Guidance: low-confidence auto-crop or photo-quality tips */}
      {mode === "view" && !busy && metadata && (() => {
        const tips = metadata.suitability?.guidance ?? [];
        if (!metadata.needs_manual && tips.length === 0) return null;
        return (
          <div className="mx-4 sm:mx-5 mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            {metadata.needs_manual && (
              <p className="text-[12px] text-amber-200 leading-snug">
                We couldn't clearly see every edge. Tap <span className="font-medium">Adjust crop</span> and
                drag the corners to line them up with the card.
              </p>
            )}
            {tips.length > 0 && (
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                {tips.map((t, i) => (
                  <li key={i} className="text-[11px] text-amber-200/90 leading-snug">{t}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      {/* Main stage */}
      <div className="flex-1 min-h-0 px-4 sm:px-5 flex flex-col">
        {busy ? (
          <ProcessingStage label={uploading ? "Reading your file…" : "Finding your card…"} />
        ) : mode === "crop" ? (
          <CropPanel />
        ) : (
          <ResultStage />
        )}
      </div>

      {error && !busy && resultBase64 && (
        <p className="px-5 pt-3 text-xs text-error">{error}</p>
      )}

      {/* Action bar */}
      <div className="border-t border-border-subtle bg-surface-raised mt-3 sm:mt-4">
        <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3">
          {mode === "view" ? (
            <>
              <button
                onClick={reset}
                title="Start over with a new file"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary
                           bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">New file</span>
              </button>

              <button
                onClick={enterCrop}
                disabled={busy || !resultBase64}
                title="Fine-tune the crop by hand"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-primary
                           bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors
                           disabled:opacity-40"
              >
                <Crop className="w-4 h-4" />
                <span className="hidden sm:inline">Adjust crop</span>
              </button>

              <button
                onClick={() => setDrawerOpen(true)}
                disabled={busy}
                title="Advanced clean-up settings"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary
                           bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors
                           disabled:opacity-40"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Advanced</span>
              </button>

              <div className="ml-auto flex items-center gap-2">
                {dirty ? (
                  <button
                    onClick={applyChanges}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white
                               bg-accent rounded-lg hover:bg-accent-hover transition-colors anim-fade
                               disabled:opacity-40"
                  >
                    <Check className="w-4 h-4" />
                    Apply changes
                  </button>
                ) : (
                  <ExportControls />
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={cancelCrop}
                disabled={busy}
                title="Discard manual edits"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary
                           bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors
                           disabled:opacity-40"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Cancel</span>
              </button>
              <button
                onClick={resetCrop}
                disabled={busy}
                title="Restore the auto-detected crop"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary
                           bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors
                           disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Reset to auto</span>
              </button>

              <button
                onClick={applyChanges}
                disabled={busy || !cropDirty}
                className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white
                           bg-accent rounded-lg hover:bg-accent-hover transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                Apply changes
              </button>
            </>
          )}
        </div>
      </div>

      <AdvancedDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        dirty={dirty}
        onApply={applyChanges}
      />
    </div>
  );
}
