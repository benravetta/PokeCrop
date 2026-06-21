import { useEffect, useRef } from "react";
import { Crosshair } from "lucide-react";
import {
  type CardSide,
  type InnerBox,
  ratiosFromBox,
  centeringCeiling,
  ceilingLabel,
  detectInnerBox,
} from "../../lib/centering";

type Edge = "x0" | "x1" | "y0" | "y1";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function CenteringTool({
  side,
  imageSrc,
  box,
  onBox,
  skipped,
  onSkip,
}: {
  side: CardSide;
  imageSrc: string;
  box: InnerBox | null;
  onBox: (b: InnerBox) => void;
  skipped: boolean;
  onSkip: (v: boolean) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragEdge = useRef<Edge | null>(null);
  const autoDone = useRef(false);

  // Auto-detect the inner border once, when the image first loads.
  const runAutoDetect = () => {
    if (autoDone.current || !imgRef.current) return;
    autoDone.current = true;
    try {
      onBox(detectInnerBox(imgRef.current));
    } catch {
      onBox({ x0: 0.08, y0: 0.08, x1: 0.92, y1: 0.92 });
    }
  };

  useEffect(() => {
    // reset auto-detect when the image changes
    autoDone.current = false;
  }, [imageSrc]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const edge = dragEdge.current;
      const el = wrapRef.current;
      if (!edge || !el || !box) return;
      const rect = el.getBoundingClientRect();
      if (edge === "x0") {
        const v = (e.clientX - rect.left) / rect.width;
        onBox({ ...box, x0: clamp(v, 0.01, box.x1 - 0.08) });
      } else if (edge === "x1") {
        const v = (e.clientX - rect.left) / rect.width;
        onBox({ ...box, x1: clamp(v, box.x0 + 0.08, 0.99) });
      } else if (edge === "y0") {
        const v = (e.clientY - rect.top) / rect.height;
        onBox({ ...box, y0: clamp(v, 0.01, box.y1 - 0.08) });
      } else {
        const v = (e.clientY - rect.top) / rect.height;
        onBox({ ...box, y1: clamp(v, box.y0 + 0.08, 0.99) });
      }
    };
    const up = () => (dragEdge.current = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [box, onBox]);

  const ratios = box ? ratiosFromBox(box) : null;
  const ceiling = ratios ? centeringCeiling(ratios, side) : null;

  const pct = (n: number) => `${n * 100}%`;
  const startDrag = (edge: Edge) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragEdge.current = edge;
  };

  return (
    <div>
      <div
        ref={wrapRef}
        className={`relative w-full overflow-hidden rounded-xl border border-border-subtle bg-surface-overlay select-none ${
          skipped ? "opacity-40 pointer-events-none" : ""
        }`}
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt={`Straightened ${side}`}
          className="block w-full"
          draggable={false}
          onLoad={runAutoDetect}
          crossOrigin="anonymous"
        />

        {box && (
          <>
            {/* shaded border regions */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute top-0 bottom-0 left-0 bg-accent/15" style={{ width: pct(box.x0) }} />
              <div className="absolute top-0 bottom-0 right-0 bg-accent/15" style={{ width: pct(1 - box.x1) }} />
              <div className="absolute left-0 right-0 top-0 bg-accent/15" style={{ height: pct(box.y0) }} />
              <div className="absolute left-0 right-0 bottom-0 bg-accent/15" style={{ height: pct(1 - box.y1) }} />
            </div>

            {/* inner-design rectangle */}
            <div
              className="pointer-events-none absolute border-2 border-accent/90"
              style={{
                left: pct(box.x0),
                top: pct(box.y0),
                width: pct(box.x1 - box.x0),
                height: pct(box.y1 - box.y0),
              }}
            />

            {/* draggable edges */}
            <div
              onPointerDown={startDrag("x0")}
              className="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize"
              style={{ left: pct(box.x0) }}
            >
              <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-accent" />
            </div>
            <div
              onPointerDown={startDrag("x1")}
              className="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize"
              style={{ left: pct(box.x1) }}
            >
              <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-accent" />
            </div>
            <div
              onPointerDown={startDrag("y0")}
              className="absolute left-0 right-0 h-3 -mt-1.5 cursor-ns-resize"
              style={{ top: pct(box.y0) }}
            >
              <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-accent" />
            </div>
            <div
              onPointerDown={startDrag("y1")}
              className="absolute left-0 right-0 h-3 -mt-1.5 cursor-ns-resize"
              style={{ top: pct(box.y1) }}
            >
              <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-accent" />
            </div>
          </>
        )}
      </div>

      {/* readout */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {ratios && !skipped ? (
          <>
            <span className="text-sm text-text-secondary">
              L/R <span className="font-semibold text-text-primary">{ratios.leftRight.ratio}</span>
            </span>
            <span className="text-sm text-text-secondary">
              T/B <span className="font-semibold text-text-primary">{ratios.topBottom.ratio}</span>
            </span>
            {ceiling != null && (
              <span
                className={`text-xs rounded-full px-2.5 py-1 font-medium ${
                  ceiling >= 10
                    ? "bg-emerald-500/15 text-emerald-300"
                    : ceiling >= 8
                    ? "bg-accent/15 text-accent"
                    : "bg-amber-500/15 text-amber-300"
                }`}
              >
                {ceilingLabel(ceiling)}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-text-muted">Centering skipped for this side.</span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-text-muted flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5" />
          Drag the lines to the edge of the printed design.
        </p>
        <label className="text-xs text-text-secondary flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={skipped}
            onChange={(e) => onSkip(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          No clear border
        </label>
      </div>
    </div>
  );
}
