import { Loader2 } from "lucide-react";

export function LoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-sm text-text-secondary">Processing card...</p>
      </div>
    </div>
  );
}
