import { CropEditor } from "./CropEditor";
import { useAppStore } from "../hooks/useProcessing";

export function CropPanel() {
  const {
    editImageBase64,
    editImageSize,
    cropCorners,
    metadata,
    error,
    setCropCorners,
  } = useAppStore();

  const canEdit =
    editImageBase64 &&
    editImageSize &&
    cropCorners &&
    editImageSize[0] > 0 &&
    editImageSize[1] > 0;

  return (
    <div className="relative flex-1 min-h-0 w-full rounded-2xl bg-surface-overlay overflow-hidden">
      {error && !canEdit ? (
        <div className="h-full flex items-center justify-center p-6">
          <p className="text-error text-sm text-center">{error}</p>
        </div>
      ) : canEdit ? (
        <>
          <CropEditor
            imageSrc={`data:image/jpeg;base64,${editImageBase64}`}
            imageWidth={editImageSize![0]}
            imageHeight={editImageSize![1]}
            corners={cropCorners!}
            cornerRadiusPx={metadata?.estimated_corner_radius_px ?? 8}
            onChange={setCropCorners}
          />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 max-w-[90%]">
            <p className="text-[11px] text-text-secondary bg-surface-overlay/90 border border-border-subtle backdrop-blur-sm rounded-full px-3 py-1 text-center shadow-lg">
              Drag the{" "}
              <span className="text-accent font-medium">round</span> handles to the
              corners, or the{" "}
              <span style={{ color: "var(--color-handle-edge)" }} className="font-medium">
                square
              </span>{" "}
              handles to nudge each edge.
            </p>
          </div>
        </>
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-text-muted text-sm">Preparing crop…</p>
        </div>
      )}
    </div>
  );
}
