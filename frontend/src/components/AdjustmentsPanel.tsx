import { useAppStore } from "../hooks/useProcessing";
import { RotateCcw, RefreshCw } from "lucide-react";

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <label className="text-xs text-text-secondary whitespace-nowrap w-28 shrink-0">
        {label}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 min-w-[80px]"
      />
      <span className="text-xs text-text-muted w-10 text-right tabular-nums">
        {typeof value === "number" && value % 1 === 0
          ? value
          : value.toFixed(2)}
      </span>
    </div>
  );
}

export function AdjustmentsPanel() {
  const { params, setParam, resetParams, process, processing } = useAppStore();

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 flex-1">
      <Slider
        label="Edge sensitivity"
        value={params.edge_sensitivity}
        onChange={(v) => setParam("edge_sensitivity", v)}
      />
      <Slider
        label="Contour threshold"
        value={params.contour_threshold}
        onChange={(v) => setParam("contour_threshold", v)}
      />
      <Slider
        label="Crop padding"
        value={params.crop_padding}
        onChange={(v) => setParam("crop_padding", v)}
        min={0}
        max={40}
        step={1}
      />
      <Slider
        label="Top-edge cleanup"
        value={params.top_edge_cleanup}
        onChange={(v) => setParam("top_edge_cleanup", v)}
      />
      <Slider
        label="Corner radius"
        value={params.corner_radius}
        onChange={(v) => setParam("corner_radius", v)}
      />

      <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={params.rotate_correction}
          onChange={(e) => setParam("rotate_correction", e.target.checked)}
          className="rounded border-border-subtle bg-surface-overlay accent-accent"
        />
        Rotate correction
      </label>

      <div className="flex items-center gap-2 ml-auto lg:ml-0">
        <button
          onClick={resetParams}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary
                     bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
        <button
          onClick={process}
          disabled={processing}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white
                     bg-accent rounded-lg hover:bg-accent-hover transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${processing ? "animate-spin" : ""}`} />
          Reprocess
        </button>
      </div>
    </div>
  );
}
