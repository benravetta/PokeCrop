import { OriginalPreview } from "./OriginalPreview";
import { DetectionOverlay } from "./DetectionOverlay";
import { ResultPreview } from "./ResultPreview";
import { AdjustmentsPanel } from "./AdjustmentsPanel";
import { ExportControls } from "./ExportControls";
import { LoadingOverlay } from "./LoadingOverlay";
import { useAppStore } from "../hooks/useProcessing";

export function Workspace() {
  const { processing, uploading } = useAppStore();

  return (
    <div className="flex-1 flex flex-col">
      {/* Panels */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-px bg-border-subtle min-h-0">
        <div className="bg-surface p-4 flex flex-col min-h-0">
          <OriginalPreview />
        </div>
        <div className="bg-surface p-4 flex flex-col min-h-0 relative">
          <DetectionOverlay />
          {(processing || uploading) && <LoadingOverlay />}
        </div>
        <div className="bg-surface p-4 flex flex-col min-h-0">
          <ResultPreview />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border-subtle bg-surface-raised">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 p-4">
          <AdjustmentsPanel />
          <div className="lg:ml-auto">
            <ExportControls />
          </div>
        </div>
      </div>
    </div>
  );
}
