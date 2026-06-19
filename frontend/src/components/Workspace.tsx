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
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
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

      {/* Main stage */}
      <div className="flex-1 min-h-0 px-5 flex flex-col">
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
      <div className="border-t border-border-subtle bg-surface-raised mt-4">
        <div className="flex items-center gap-2 px-5 py-3 flex-wrap">
          {mode === "view" ? (
            <>
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary
                           bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                New file
              </button>

              <button
                onClick={enterCrop}
                disabled={busy || !resultBase64}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-primary
                           bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors
                           disabled:opacity-40"
              >
                <Crop className="w-4 h-4" />
                Adjust crop
              </button>

              <button
                onClick={() => setDrawerOpen(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary
                           bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors
                           disabled:opacity-40"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Advanced
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
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary
                           bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors
                           disabled:opacity-40"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={resetCrop}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary
                           bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors
                           disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to auto
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
