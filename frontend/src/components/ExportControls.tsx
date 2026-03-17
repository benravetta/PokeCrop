import { useAppStore } from "../hooks/useProcessing";
import { exportUrl } from "../lib/api";
import { Download, ArrowLeft } from "lucide-react";

export function ExportControls() {
  const { sessionId, resultBase64, reset } = useAppStore();

  const handleExport = (size: "original" | "web") => {
    if (!sessionId) return;
    const url = exportUrl(sessionId, size);
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={reset}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary
                   bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        New file
      </button>

      {resultBase64 && (
        <>
          <button
            onClick={() => handleExport("web")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-primary
                       bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Web size
          </button>
          <button
            onClick={() => handleExport("original")}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white
                       bg-accent rounded-lg hover:bg-accent-hover transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Original size
          </button>
        </>
      )}
    </div>
  );
}
