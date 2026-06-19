import { Loader2 } from "lucide-react";

export function ProcessingStage({ label }: { label?: string }) {
  return (
    <div className="w-full h-full rounded-2xl bg-surface-overlay flex flex-col items-center justify-center gap-5 anim-fade">
      {/* Card-shaped skeleton placeholder (standard 63:88 trading-card ratio) */}
      <div
        className="skeleton rounded-xl border border-border-subtle"
        style={{ width: "min(38vh, 220px)", aspectRatio: "63 / 88" }}
      />
      <div className="flex items-center gap-2 text-text-secondary">
        <Loader2 className="w-4 h-4 text-accent animate-spin" />
        <p className="text-sm">{label ?? "Finding your card…"}</p>
      </div>
    </div>
  );
}
