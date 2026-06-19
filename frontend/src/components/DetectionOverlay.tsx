import { RotateCcw } from "lucide-react";
import { CropEditor } from "./CropEditor";
import { useAppStore } from "../hooks/useProcessing";

export function DetectionOverlay() {
  const {
    editImageBase64,
    editImageSize,
    cropCorners,
    metadata,
    error,
    processing,
    setCropCorners,
    resetCrop,
    process,
    cropDirty,
  } = useAppStore();

  const canEdit =
    editImageBase64 &&
    editImageSize &&
    cropCorners &&
    editImageSize[0] > 0 &&
    editImageSize[1] > 0;

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Crop
        </h3>
        {metadata && (
          <span className="text-xs text-text-muted ml-auto">
            r≈{metadata.estimated_corner_radius_px}px &middot; drag corners or edges
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <p className="text-[11px] text-text-muted leading-snug">
          Green handles match the card&apos;s rounded corners. Blue handles move a whole
          side in to trim background or out to keep border.
        </p>
        <div className="ml-auto flex gap-2 shrink-0">
          <button
            type="button"
            disabled={!cropDirty || processing}
            onClick={() => resetCrop()}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md
                       bg-surface-overlay hover:bg-border-subtle disabled:opacity-40"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          <button
            type="button"
            disabled={!cropDirty || processing}
            onClick={() => process()}
            className="text-xs px-2 py-1 rounded-md bg-accent text-white
                       hover:opacity-90 disabled:opacity-40"
          >
            Apply crop
          </button>
        </div>
      </div>

      <div className="flex-1 rounded-xl bg-surface-overlay overflow-hidden min-h-[200px] relative">
        {error && !canEdit ? (
          <div className="p-6 text-center h-full flex items-center justify-center">
            <p className="text-error text-sm">{error}</p>
          </div>
        ) : canEdit ? (
          <CropEditor
            imageSrc={`data:image/jpeg;base64,${editImageBase64}`}
            imageWidth={editImageSize[0]}
            imageHeight={editImageSize[1]}
            corners={cropCorners}
            cornerRadiusPx={metadata?.estimated_corner_radius_px ?? 8}
            onChange={setCropCorners}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-text-muted text-sm">Waiting for processing...</p>
          </div>
        )}
      </div>
    </>
  );
}
