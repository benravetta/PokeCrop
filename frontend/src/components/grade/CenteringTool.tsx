import { useEffect, useRef } from "react";
import { Crosshair, AlertTriangle } from "lucide-react";
import {
  type CardSide,
  type Box,
  borderRatios,
  centeringCeiling,
  ceilingLabel,
  detectBorders,
} from "../../lib/centering";

type BoxId = "outer" | "inner";
type Edge = "x0" | "x1" | "y0" | "y1";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MIN = 0.04; // minimum span / gap between edges

export function CenteringTool({
  side,
  imageSrc,
  outer,
  inner,
  onOuter,
  onInner,
  skipped,
  onSkip,
}: {
  side: CardSide;
  imageSrc: string;
  outer: Box | null;
  inner: Box | null;
  onOuter: (b: Box) => void;
  onInner: (b: Box) => void;
  skipped: boolean;
  onSkip: (v: boolean) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ box: BoxId; edge: Edge } | null>(null);
  const autoDone = useRef(false);

  const runAutoDetect = () => {
    if (autoDone.current || !imgRef.current) return;
    autoDone.current = true;
    try {
      const { outer: o, inner: i } = detectBorders(imgRef.current);
      onOuter(o);
      onInner(i);
    } catch {
      onOuter({ x0: 0, y0: 0, x1: 1, y1: 1 });
      onInner({ x0: 0.09, y0: 0.07, x1: 0.91, y1: 0.93 });
    }
  };

  useEffect(() => {
    autoDone.current = false;
  }, [imageSrc]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      const el = wrapRef.current;
      if (!d || !el || !outer || !inner) return;
      const rect = el.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      if (d.box === "outer") {
        const o = { ...outer };
        if (d.edge === "x0") o.x0 = clamp(fx, 0, inner.x0 - MIN);
        else if (d.edge === "x1") o.x1 = clamp(fx, inner.x1 + MIN, 1);
        else if (d.edge === "y0") o.y0 = clamp(fy, 0, inner.y0 - MIN);
        else o.y1 = clamp(fy, inner.y1 + MIN, 1);
        onOuter(o);
      } else {
        const i = { ...inner };
        if (d.edge === "x0") i.x0 = clamp(fx, outer.x0, i.x1 - MIN);
        else if (d.edge === "x1") i.x1 = clamp(fx, i.x0 + MIN, outer.x1);
        else if (d.edge === "y0") i.y0 = clamp(fy, outer.y0, i.y1 - MIN);
        else i.y1 = clamp(fy, i.y0 + MIN, outer.y1);
        onInner(i);
      }
    };
    const up = () => (drag.current = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [outer, inner, onOuter, onInner]);

  const ready = outer && inner;
  const ratios = ready ? borderRatios(outer!, inner!) : null;
  const ceiling = ratios ? centeringCeiling(ratios, side) : null;

  const pct = (n: number) => `${n * 100}%`;
  const startDrag = (box: BoxId, edge: Edge) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { box, edge };
  };

  const edgeBars = (box: BoxId, b: Box, colour: string) => (
    <>
      <div onPointerDown={startDrag(box, "x0")} className="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize z-10" style={{ left: pct(b.x0) }}>
        <div className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 ${colour}`} />
      </div>
      <div onPointerDown={startDrag(box, "x1")} className="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize z-10" style={{ left: pct(b.x1) }}>
        <div className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 ${colour}`} />
      </div>
      <div onPointerDown={startDrag(box, "y0")} className="absolute left-0 right-0 h-3 -mt-1.5 cursor-ns-resize z-10" style={{ top: pct(b.y0) }}>
        <div className={`absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 ${colour}`} />
      </div>
      <div onPointerDown={startDrag(box, "y1")} className="absolute left-0 right-0 h-3 -mt-1.5 cursor-ns-resize z-10" style={{ top: pct(b.y1) }}>
        <div className={`absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 ${colour}`} />
      </div>
    </>
  );

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

        {ready && (
          <>
            {/* shade the measured border band (between outer and inner) */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute bg-sky-400/15" style={{ left: pct(outer!.x0), top: pct(outer!.y0), width: pct(inner!.x0 - outer!.x0), height: pct(outer!.y1 - outer!.y0) }} />
              <div className="absolute bg-sky-400/15" style={{ left: pct(inner!.x1), top: pct(outer!.y0), width: pct(outer!.x1 - inner!.x1), height: pct(outer!.y1 - outer!.y0) }} />
              <div className="absolute bg-sky-400/15" style={{ left: pct(inner!.x0), top: pct(outer!.y0), width: pct(inner!.x1 - inner!.x0), height: pct(inner!.y0 - outer!.y0) }} />
              <div className="absolute bg-sky-400/15" style={{ left: pct(inner!.x0), top: pct(inner!.y1), width: pct(inner!.x1 - inner!.x0), height: pct(outer!.y1 - inner!.y1) }} />
            </div>

            {/* outer rectangle (card edge) */}
            <div className="pointer-events-none absolute border-2 border-dashed border-sky-400/90" style={{ left: pct(outer!.x0), top: pct(outer!.y0), width: pct(outer!.x1 - outer!.x0), height: pct(outer!.y1 - outer!.y0) }} />
            {/* inner rectangle (art edge) */}
            <div className="pointer-events-none absolute border-2 border-accent/90" style={{ left: pct(inner!.x0), top: pct(inner!.y0), width: pct(inner!.x1 - inner!.x0), height: pct(inner!.y1 - inner!.y0) }} />

            {edgeBars("outer", outer!, "bg-sky-400")}
            {edgeBars("inner", inner!, "bg-accent")}
          </>
        )}
      </div>

      {/* legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 border-t-2 border-dashed border-sky-400" /> Card edge</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 border-t-2 border-accent" /> Inner border</span>
      </div>

      {/* readout */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
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

      {!skipped && (
        <p className="mt-2 text-[11px] text-amber-300/80 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Side numbers off? A curled card (often holos) or one shot inside a
          sleeve/toploader skews L/R centering — lay it flat and bare and re-shoot.
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-text-muted flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5" />
          Set the dashed box to the card edge and the solid box to where the artwork starts.
        </p>
        <label className="text-xs text-text-secondary flex items-center gap-1.5 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={skipped}
            onChange={(e) => onSkip(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          No border
        </label>
      </div>
    </div>
  );
}
