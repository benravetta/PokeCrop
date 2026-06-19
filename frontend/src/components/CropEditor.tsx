import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampCorners,
  cloneCorners,
  CropCorners,
  edgeMidpoint,
  EdgeId,
  moveEdge,
  Point,
  roundedCropPath,
} from "../lib/cropGeometry";

type HandleKind =
  | { type: "corner"; index: number }
  | { type: "edge"; edge: EdgeId };

interface CropEditorProps {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  corners: CropCorners;
  cornerRadiusPx: number;
  onChange: (corners: CropCorners) => void;
}

const LOUPE_SIZE = 148;
const LOUPE_ZOOM = 4.5;

function fitContain(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number
) {
  if (containerW <= 0 || containerH <= 0 || imageW <= 0 || imageH <= 0) {
    return { x: 0, y: 0, width: 0, height: 0, scale: 1 };
  }
  const scale = Math.min(containerW / imageW, containerH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  return {
    x: (containerW - width) / 2,
    y: (containerH - height) / 2,
    width,
    height,
    scale,
  };
}

function unit(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function sameHandle(a: HandleKind | null, b: HandleKind | null): boolean {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === "corner" && b.type === "corner") return a.index === b.index;
  if (a.type === "edge" && b.type === "edge") return a.edge === b.edge;
  return false;
}

export function CropEditor({
  imageSrc,
  imageWidth,
  imageHeight,
  corners,
  cornerRadiusPx,
  onChange,
}: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [activeHandle, setActiveHandle] = useState<HandleKind | null>(null);
  const [hoverHandle, setHoverHandle] = useState<HandleKind | null>(null);
  const dragRef = useRef<{
    kind: HandleKind;
    startCorners: CropCorners;
    startClient: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setBox({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [imageSrc]);

  const fit = fitContain(box.width, box.height, imageWidth, imageHeight);

  const toDisplay = useCallback(
    (p: Point) => ({
      x: fit.x + p.x * fit.scale,
      y: fit.y + p.y * fit.scale,
    }),
    [fit.x, fit.y, fit.scale]
  );

  const toImage = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || fit.scale <= 0) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - fit.x) / fit.scale,
        y: (clientY - rect.top - fit.y) / fit.scale,
      };
    },
    [fit.x, fit.y, fit.scale]
  );

  const onPointerDown = (kind: HandleKind) => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.pointerId);
    dragRef.current = {
      kind,
      startCorners: cloneCorners(corners),
      startClient: { x: event.clientX, y: event.clientY },
    };
    setActiveHandle(kind);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    const startImage = toImage(drag.startClient.x, drag.startClient.y);
    const currentImage = toImage(event.clientX, event.clientY);
    const dx = currentImage.x - startImage.x;
    const dy = currentImage.y - startImage.y;

    let next = drag.startCorners;
    if (drag.kind.type === "corner") {
      next = cloneCorners(drag.startCorners);
      next[drag.kind.index] = {
        x: drag.startCorners[drag.kind.index].x + dx,
        y: drag.startCorners[drag.kind.index].y + dy,
      };
    } else {
      next = moveEdge(drag.startCorners, drag.kind.edge, dx, dy);
    }

    onChange(clampCorners(next, imageWidth, imageHeight));
  };

  const onPointerUp = () => {
    dragRef.current = null;
    setActiveHandle(null);
  };

  const displayCorners = corners.map(toDisplay) as CropCorners;
  const path = roundedCropPath(displayCorners, cornerRadiusPx * fit.scale);
  const edges: EdgeId[] = ["top", "right", "bottom", "left"];

  // The handle currently in focus (being dragged, or hovered) drives the loupe.
  const focus = activeHandle ?? hoverHandle;
  const focusImagePoint: Point | null = focus
    ? focus.type === "corner"
      ? corners[focus.index]
      : edgeMidpoint(corners, focus.edge)
    : null;
  const focusDisplay = focusImagePoint ? toDisplay(focusImagePoint) : null;

  // Place the loupe in the corner of the stage away from the active handle so
  // it never sits under the cursor/finger.
  const loupeOnRight = focusDisplay ? focusDisplay.x < box.width / 2 : true;
  const loupeOnBottom = focusDisplay ? focusDisplay.y < box.height * 0.4 : false;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[200px] select-none touch-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={imageSrc}
          alt="Crop editor"
          style={{ width: fit.width || undefined, height: fit.height || undefined }}
          className="object-contain pointer-events-none max-w-full max-h-full"
          draggable={false}
        />
      </div>

      {fit.scale > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden
        >
          <path
            d={path}
            fill="var(--color-accent-soft)"
            stroke="var(--color-crop-stroke)"
            strokeWidth={2}
          />
        </svg>
      )}

      {fit.scale > 0 && (
        <svg className="absolute inset-0 w-full h-full">
          {edges.map((edge) => {
            const mid = toDisplay(edgeMidpoint(corners, edge));
            const isFocus = sameHandle(focus, { type: "edge", edge });
            const s = isFocus ? 9 : 7;
            return (
              <rect
                key={edge}
                x={mid.x - s}
                y={mid.y - s}
                width={s * 2}
                height={s * 2}
                rx={3}
                fill="var(--color-handle-edge)"
                stroke="white"
                strokeWidth={isFocus ? 2 : 1}
                className="cursor-move pointer-events-auto"
                onPointerDown={onPointerDown({ type: "edge", edge })}
                onPointerEnter={() => setHoverHandle({ type: "edge", edge })}
                onPointerLeave={() =>
                  setHoverHandle((h) =>
                    sameHandle(h, { type: "edge", edge }) ? null : h
                  )
                }
              />
            );
          })}

          {displayCorners.map((d, index) => {
            const prev = displayCorners[(index + 3) % 4];
            const next = displayCorners[(index + 1) % 4];
            const u1 = unit(d, prev);
            const u2 = unit(d, next);
            const arm = 18;
            const a1 = { x: d.x + u1.x * arm, y: d.y + u1.y * arm };
            const a2 = { x: d.x + u2.x * arm, y: d.y + u2.y * arm };
            const isFocus = sameHandle(focus, { type: "corner", index });
            return (
              <g key={index}>
                {/* Right-angle bracket following the two card edges */}
                <polyline
                  points={`${a1.x},${a1.y} ${d.x},${d.y} ${a2.x},${a2.y}`}
                  fill="none"
                  stroke={isFocus ? "white" : "var(--color-handle-corner)"}
                  strokeWidth={isFocus ? 4 : 3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none"
                />
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={3}
                  fill="white"
                  className="pointer-events-none"
                />
                {/* Generous transparent grab target */}
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={16}
                  fill="transparent"
                  className="cursor-grab active:cursor-grabbing pointer-events-auto"
                  onPointerDown={onPointerDown({ type: "corner", index })}
                  onPointerEnter={() =>
                    setHoverHandle({ type: "corner", index })
                  }
                  onPointerLeave={() =>
                    setHoverHandle((h) =>
                      sameHandle(h, { type: "corner", index }) ? null : h
                    )
                  }
                />
              </g>
            );
          })}
        </svg>
      )}

      {focusImagePoint && fit.scale > 0 && (
        <Loupe
          imageSrc={imageSrc}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          corners={corners}
          cornerRadiusPx={cornerRadiusPx}
          focus={focusImagePoint}
          onRight={loupeOnRight}
          onBottom={loupeOnBottom}
        />
      )}
    </div>
  );
}

function Loupe({
  imageSrc,
  imageWidth,
  imageHeight,
  corners,
  cornerRadiusPx,
  focus,
  onRight,
  onBottom,
}: {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  corners: CropCorners;
  cornerRadiusPx: number;
  focus: Point;
  onRight: boolean;
  onBottom: boolean;
}) {
  // Map an image-space point into the loupe's local coordinates.
  const toLoupe = (p: Point): Point => ({
    x: LOUPE_SIZE / 2 + (p.x - focus.x) * LOUPE_ZOOM,
    y: LOUPE_SIZE / 2 + (p.y - focus.y) * LOUPE_ZOOM,
  });

  const loupeCorners = corners.map(toLoupe) as CropCorners;
  const path = roundedCropPath(loupeCorners, cornerRadiusPx * LOUPE_ZOOM);
  const c = LOUPE_SIZE / 2;

  return (
    <div
      className="absolute z-20 rounded-xl border border-border-strong shadow-2xl overflow-hidden pointer-events-none"
      style={{
        width: LOUPE_SIZE,
        height: LOUPE_SIZE,
        top: onBottom ? undefined : 12,
        bottom: onBottom ? 12 : undefined,
        left: onRight ? undefined : 12,
        right: onRight ? 12 : undefined,
        backgroundColor: "#0e1018",
        backgroundImage: `url(${imageSrc})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${imageWidth * LOUPE_ZOOM}px ${imageHeight * LOUPE_ZOOM}px`,
        backgroundPosition: `${c - focus.x * LOUPE_ZOOM}px ${c - focus.y * LOUPE_ZOOM}px`,
      }}
    >
      <svg width={LOUPE_SIZE} height={LOUPE_SIZE} className="absolute inset-0">
        <path
          d={path}
          fill="var(--color-accent-soft)"
          stroke="var(--color-crop-stroke)"
          strokeWidth={1.5}
        />
        {/* Crosshair marking the exact handle position */}
        <line x1={c} y1={c - 12} x2={c} y2={c + 12} stroke="white" strokeWidth={1} opacity={0.9} />
        <line x1={c - 12} y1={c} x2={c + 12} y2={c} stroke="white" strokeWidth={1} opacity={0.9} />
        <circle cx={c} cy={c} r={2.5} fill="none" stroke="white" strokeWidth={1} />
      </svg>
    </div>
  );
}
