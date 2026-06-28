import { useMemo, useState } from "react";
import { useAppStore } from "../hooks/useProcessing";
import { mimeFromFilename } from "../lib/mime";
import { DetectionOverlay } from "./DetectionOverlay";

type View = "after" | "before";

function scaleCorners(
  corners: number[][] | undefined,
  workingSize: [number, number] | undefined,
  displayW: number,
  displayH: number
): number[][] | undefined {
  if (!corners || !workingSize) return corners;
  const [ww, wh] = workingSize;
  if (ww <= 0 || wh <= 0 || displayW <= 0 || displayH <= 0) return corners;
  const sx = displayW / ww;
  const sy = displayH / wh;
  return corners.map(([x, y]) => [x * sx, y * sy]);
}

export function ResultStage() {
  const { resultBase64, originalBase64, filename, metadata } = useAppStore();
  const [view, setView] = useState<View>("after");
  const [beforeSize, setBeforeSize] = useState<[number, number] | null>(null);

  const mime = mimeFromFilename(filename);
  const isPdf = mime === "application/pdf";

  const overlayCorners = useMemo(
    () =>
      scaleCorners(
        metadata?.working_corners,
        metadata?.working_size,
        beforeSize?.[0] ?? 0,
        beforeSize?.[1] ?? 0
      ),
    [metadata?.working_corners, metadata?.working_size, beforeSize]
  );

  const showReviewOverlay =
    view === "before" &&
    Boolean(metadata?.needs_review) &&
    overlayCorners &&
    beforeSize;

  return (
    <div className="relative flex-1 min-h-0 w-full flex flex-col">
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-surface-overlay/90 border border-border-subtle backdrop-blur-sm shadow-lg">
          {(["before", "after"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                view === v
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {metadata?.needs_review && view === "before" && (
        <p className="absolute top-14 left-1/2 z-10 -translate-x-1/2 rounded-full bg-sky-500/15 px-3 py-1 text-[11px] text-sky-100">
          Review detected edges before confirming
        </p>
      )}

      <div
        className={`flex-1 rounded-2xl overflow-hidden flex items-center justify-center min-h-0 ${
          view === "after" ? "checkerboard" : "bg-surface-overlay"
        }`}
      >
        {view === "after" ? (
          resultBase64 ? (
            <img
              key="after"
              src={`data:image/png;base64,${resultBase64}`}
              alt="Extracted card"
              className="max-w-full max-h-full object-contain drop-shadow-2xl p-6 anim-scale"
            />
          ) : (
            <p className="text-text-muted text-sm">No result yet</p>
          )
        ) : originalBase64 ? (
          isPdf ? (
            <object
              key="before-pdf"
              data={`data:${mime};base64,${originalBase64}#toolbar=0&navpanes=0&scrollbar=0`}
              type="application/pdf"
              className="w-full h-full min-h-[320px]"
            >
              <p className="text-text-muted text-sm px-4 text-center">
                PDF preview could not be rendered in-browser.
              </p>
            </object>
          ) : (
            <div className="relative flex max-h-full max-w-full items-center justify-center p-6">
              <img
                key="before"
                src={`data:${mime};base64,${originalBase64}`}
                alt="Original upload"
                className="max-w-full max-h-full object-contain anim-fade"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setBeforeSize([img.clientWidth, img.clientHeight]);
                }}
              />
              {showReviewOverlay && (
                <DetectionOverlay
                  width={beforeSize[0]}
                  height={beforeSize[1]}
                  corners={overlayCorners}
                />
              )}
            </div>
          )
        ) : (
          <p className="text-text-muted text-sm">No image</p>
        )}
      </div>
    </div>
  );
}
