import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StickyFooterBar } from "./pageLayout";
import {
  Crop,
  SlidersHorizontal,
  ArrowLeft,
  Check,
  RotateCcw,
  X,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { ResultStage } from "./ResultStage";
import { CropPanel } from "./CropPanel";
import { ProcessingStage } from "./ProcessingStage";
import { AdvancedDrawer } from "./AdvancedDrawer";
import { ExportControls } from "./ExportControls";
import { CropCentringPanel } from "./CropCentringPanel";
import { SingleGradePromo } from "./SingleGradePromo";
import { useAppStore, paramsDiffer } from "../hooks/useProcessing";
import { useMe } from "../hooks/useMe";
import { PlanUsageStrip } from "./plan/PlanUsageCard";
import { fetchExport } from "../lib/api";
import { boxFromFrac } from "../lib/centering";

// Read a Blob back as raw base64 (no data: prefix), matching the store's
// resultBase64 format.
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

type Mode = "view" | "crop";

export function Workspace() {
  const {
    processing,
    uploading,
    cropDirty,
    params,
    appliedParams,
    sessionId,
    resultBase64,
    filename,
    metadata,
    error,
    process,
    resetCrop,
    revertCrop,
    reset,
    setGradePrefill,
    historyEventId,
    cropConfirmed,
    confirmBusy,
    confirmCrop,
  } = useAppStore();

  const navigate = useNavigate();
  const me = useMe((s) => s.me);
  const [mode, setMode] = useState<Mode>("view");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const busy = processing || uploading;
  const dirty = cropDirty || paramsDiffer(params, appliedParams);

  useEffect(() => {
    if (!metadata?.needs_manual || busy || !resultBase64) return;
    setMode("crop");
  }, [metadata?.needs_manual, busy, resultBase64]);

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

  // Stash the cropped card (full-res when available) and jump to the grader,
  // which prefills the front slot. Falls back to the web preview on failure.
  const sendToGrading = async () => {
    if (!sessionId || !resultBase64 || sending) return;
    setSending(true);
    let pngBase64 = resultBase64;
    try {
      const blob = await fetchExport(sessionId, "original");
      pngBase64 = await blobToBase64(blob);
    } catch {
      // keep the web-preview base64 fallback
    }
    setGradePrefill({ front: { pngBase64, filename: filename ?? "card.png" } });
    setSending(false);
    navigate("/grade");
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pb-24 sm:pb-28">
      {/* Stage header */}
      <div className="flex items-center gap-3 page-x pt-3 sm:pt-4 pb-2.5 sm:pb-3">
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

      <PlanUsageStrip me={me} />

      {/* Guidance: low-confidence auto-crop or photo-quality tips */}
      {mode === "view" && !busy && metadata && (() => {
        const tips = metadata.suitability?.guidance ?? [];
        const showGuidance =
          metadata.needs_manual || metadata.needs_review || tips.length > 0;
        if (!showGuidance) return null;
        return (
          <div className="mx-4 sm:mx-5 mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            {metadata.needs_manual && (
              <p className="text-[12px] text-amber-200 leading-snug">
                We couldn't clearly see every edge. Tap <span className="font-medium">Adjust crop</span> and
                drag the corners to line them up with the card.
              </p>
            )}
            {metadata.needs_review && !metadata.needs_manual && (
              <p className="text-[12px] text-amber-200 leading-snug">
                Check the detected outline on <span className="font-medium">Before</span>, then confirm the crop
                when it looks right.
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

      {mode === "view" && !busy && resultBase64 && (
        <SingleGradePromo compact />
      )}

      {/* Main stage */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 page-x lg:flex-row">
        {busy ? (
          <ProcessingStage phase={uploading ? "uploading" : "processing"} />
        ) : mode === "crop" ? (
          <CropPanel />
        ) : (
          <>
            <ResultStage />
            {resultBase64 && (
              <CropCentringPanel
                imageSrc={`data:image/png;base64,${resultBase64}`}
                historyEventId={historyEventId}
                outerHint={
                  metadata?.card_outer_frac
                    ? boxFromFrac(metadata.card_outer_frac)
                    : null
                }
              />
            )}
          </>
        )}
      </div>

      {error && !busy && resultBase64 && (
        <p className="page-x pt-3 text-xs text-error">{error}</p>
      )}

      <StickyFooterBar className="mt-3 sm:mt-4">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          {mode === "view" ? (
            <>
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0">
                <button
                  onClick={reset}
                  title="Start over with a new file"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary
                             bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors whitespace-nowrap"
                >
                  <ArrowLeft className="w-4 h-4" />
                  New file
                </button>

                <button
                  onClick={enterCrop}
                  disabled={busy || !resultBase64}
                  title="Fine-tune the crop by hand"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-primary
                             bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors
                             disabled:opacity-40 whitespace-nowrap"
                >
                  <Crop className="w-4 h-4" />
                  Adjust crop
                </button>

                <button
                  onClick={() => setDrawerOpen(true)}
                  disabled={busy}
                  title="Advanced clean-up settings"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary
                             bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors
                             disabled:opacity-40 whitespace-nowrap"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Advanced
                </button>
              </div>

              <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
                {dirty ? (
                  <button
                    onClick={applyChanges}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white
                               bg-accent rounded-lg hover:bg-accent-hover transition-colors anim-fade
                               disabled:opacity-40 w-full sm:w-auto justify-center"
                  >
                    <Check className="w-4 h-4" />
                    Apply changes
                  </button>
                ) : !cropConfirmed && resultBase64 ? (
                  <button
                    onClick={() => void confirmCrop()}
                    disabled={busy || confirmBusy || metadata?.needs_manual}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white
                               bg-accent rounded-lg hover:bg-accent-hover transition-colors
                               disabled:opacity-40 w-full sm:w-auto justify-center"
                  >
                    {confirmBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Confirm crop
                  </button>
                ) : (
                  <>
                    <button
                      onClick={sendToGrading}
                      disabled={busy || sending || !resultBase64 || !sessionId}
                      title="Send this cropped card to the AI pre-grader"
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white
                                 bg-accent rounded-lg hover:bg-accent-hover transition-colors
                                 disabled:opacity-40 w-full sm:w-auto justify-center"
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      Send to grading
                    </button>
                    <ExportControls />
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0">
                <button
                  onClick={cancelCrop}
                  disabled={busy}
                  title="Discard manual edits"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary
                             bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors
                             disabled:opacity-40 whitespace-nowrap"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={resetCrop}
                  disabled={busy}
                  title="Restore the auto-detected crop"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary
                             bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors
                             disabled:opacity-40 whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to auto
                </button>
              </div>

              <button
                onClick={applyChanges}
                disabled={busy || !cropDirty}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white
                           bg-accent rounded-lg hover:bg-accent-hover transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto sm:ml-auto justify-center"
              >
                <Check className="w-4 h-4" />
                Apply changes
              </button>
            </>
          )}
        </div>
      </StickyFooterBar>

      <AdvancedDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        dirty={dirty}
        onApply={applyChanges}
      />
    </div>
  );
}
