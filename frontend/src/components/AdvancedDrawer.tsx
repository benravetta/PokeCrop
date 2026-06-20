import { useAppStore } from "../hooks/useProcessing";
import { RotateCcw, RotateCw, X, Check } from "lucide-react";

function Slider({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm text-text-primary">{label}</label>
        <span className="text-xs text-text-muted tabular-nums">
          {value % 1 === 0 ? value : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      <p className="text-[11px] text-text-muted leading-snug">{hint}</p>
    </div>
  );
}

export function AdvancedDrawer({
  open,
  onClose,
  dirty,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  dirty: boolean;
  onApply: () => void;
}) {
  const { params, setParam, rotateOutput, resetParams, processing } = useAppStore();
  const rotation = params.output_rotation ?? 0;

  return (
    <>
      {/* Scrim */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 z-40 h-full w-full max-w-sm bg-surface-raised border-l border-border-subtle
                    flex flex-col shadow-2xl transition-transform duration-300 ease-out
                    ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-label="Advanced settings"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Advanced settings</h2>
            <p className="text-[11px] text-text-muted">Fine-tune how the card is detected.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-text-primary">Orientation</span>
                <p className="text-[11px] text-text-muted">
                  Auto-detected. Rotate if it came out the wrong way up.
                </p>
              </div>
              <span className="text-xs text-text-muted tabular-nums">{rotation}&deg;</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => rotateOutput(-90)}
                disabled={processing}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-text-primary
                           bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Rotate left
              </button>
              <button
                onClick={() => rotateOutput(90)}
                disabled={processing}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-text-primary
                           bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Rotate right
              </button>
            </div>
          </div>

          <div className="border-t border-border-subtle" />

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <span className="text-sm text-text-primary">Auto-straighten</span>
              <p className="text-[11px] text-text-muted">Rotate tilted cards level.</p>
            </div>
            <input
              type="checkbox"
              checked={params.rotate_correction}
              onChange={(e) => setParam("rotate_correction", e.target.checked)}
              className="w-4 h-4 rounded border-border-subtle bg-surface-overlay accent-accent"
            />
          </label>

          <div className="flex flex-col gap-5 pt-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
              Edge clean-up
            </p>
            <Slider
              label="Background removal"
              hint="Erase leftover table or scan colour bleeding in from the edges."
              value={params.bg_removal}
              onChange={(v) => setParam("bg_removal", v)}
            />
            <Slider
              label="Edge trim"
              hint="Shave the outer edge inward to remove a thin background ring."
              value={params.edge_trim}
              onChange={(v) => setParam("edge_trim", v)}
              min={0}
              max={40}
              step={1}
            />
          </div>

          <div className="border-t border-border-subtle" />

          <Slider
            label="Edge detection"
            hint="Higher finds faint edges; lower ignores busy backgrounds."
            value={params.edge_sensitivity}
            onChange={(v) => setParam("edge_sensitivity", v)}
          />
          <Slider
            label="Detection strictness"
            hint="How card-shaped a region must be to count as the card."
            value={params.contour_threshold}
            onChange={(v) => setParam("contour_threshold", v)}
          />
          <Slider
            label="Border padding"
            hint="Extra pixels kept around the card edge."
            value={params.crop_padding}
            onChange={(v) => setParam("crop_padding", v)}
            min={0}
            max={40}
            step={1}
          />
          <Slider
            label="Top-edge cleanup"
            hint="Trims glare or background bleeding over the top edge."
            value={params.top_edge_cleanup}
            onChange={(v) => setParam("top_edge_cleanup", v)}
          />
          <Slider
            label="Corner rounding"
            hint="Match the card's rounded-corner radius."
            value={params.corner_radius}
            onChange={(v) => setParam("corner_radius", v)}
          />
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border-subtle">
          <button
            onClick={resetParams}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-text-secondary
                       bg-surface-overlay rounded-lg hover:bg-border-subtle transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={onApply}
            disabled={!dirty || processing}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white
                       bg-accent rounded-lg hover:bg-accent-hover transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            Apply changes
          </button>
        </div>
      </aside>
    </>
  );
}
