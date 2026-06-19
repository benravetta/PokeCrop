import { useState } from "react";
import { useAppStore } from "../hooks/useProcessing";
import { mimeFromFilename } from "../lib/mime";

type View = "after" | "before";

export function ResultStage() {
  const { resultBase64, originalBase64, filename } = useAppStore();
  const [view, setView] = useState<View>("after");

  const mime = mimeFromFilename(filename);
  const isPdf = mime === "application/pdf";

  return (
    <div className="relative flex-1 min-h-0 w-full flex flex-col">
      {/* Before / After toggle */}
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
            <img
              key="before"
              src={`data:${mime};base64,${originalBase64}`}
              alt="Original upload"
              className="max-w-full max-h-full object-contain p-6 anim-fade"
            />
          )
        ) : (
          <p className="text-text-muted text-sm">No image</p>
        )}
      </div>
    </div>
  );
}
