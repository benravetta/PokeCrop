import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  loadLuminance,
  refineCorner,
  snapCornerToCardEdges,
} from "../lib/cornerSnap";

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
  // The editor zooms to the current crop region (+ margin) so the card fills the
  // canvas for precise corner work, rather than showing the whole source photo.
  // Frozen when a new image loads so dragging doesn't continuously re-zoom.
  const [viewport, setViewport] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [activeHandle, setActiveHandle] = useState<HandleKind | null>(null);
  const [hoverHandle, setHoverHandle] = useState<HandleKind | null>(null);
  const [snapFlash, setSnapFlash] = useState<number | null>(null);
  const grayRef = useRef<Float32Array | null>(null);
  const dragRef = useRef<{
    kind: HandleKind;
    startCorners: CropCorners;
    startClient: { x: number; y: number };
  } | null>(null);

  // Touch devices need larger grab targets than a mouse pointer.
  const coarsePointer = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches,
    []
  );

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

  // Freeze the zoom viewport to the crop region present when this image loads.
  // Intentionally excludes `corners` from deps so dragging doesn't re-zoom.
  useEffect(() => {
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cardW = Math.max(maxX - minX, 1);
    const cardH = Math.max(maxY - minY, 1);
    // Generous margin so corners can still be dragged outward to recover a card
    // edge the auto-detector clipped.
    const margin = Math.max(cardW, cardH) * 0.22 + 12;
    const vx = Math.max(0, minX - margin);
    const vy = Math.max(0, minY - margin);
    const vw = Math.min(imageWidth, maxX + margin) - vx;
    const vh = Math.min(imageHeight, maxY + margin) - vy;
    if (vw > 0 && vh > 0) {
      setViewport({ x: vx, y: vy, width: vw, height: vh });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc, imageWidth, imageHeight]);

  // Decode the editing image into a luminance buffer so dropped corners can snap
  // onto the nearest real corner via sub-pixel refinement.
  useEffect(() => {
    let cancelled = false;
    grayRef.current = null;
    loadLuminance(imageSrc, imageWidth, imageHeight).then((gray) => {
      if (!cancelled) grayRef.current = gray;
    });
    return () => {
      cancelled = true;
    };
  }, [imageSrc, imageWidth, imageHeight]);

  const vp = viewport ?? { x: 0, y: 0, width: imageWidth, height: imageHeight };
  const fit = fitContain(box.width, box.height, vp.width, vp.height);

  const toDisplay = useCallback(
    (p: Point) => ({
      x: fit.x + (p.x - vp.x) * fit.scale,
      y: fit.y + (p.y - vp.y) * fit.scale,
    }),
    [fit.x, fit.y, fit.scale, vp.x, vp.y]
  );

  const toImage = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || fit.scale <= 0) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - fit.x) / fit.scale + vp.x,
        y: (clientY - rect.top - fit.y) / fit.scale + vp.y,
      };
    },
    [fit.x, fit.y, fit.scale, vp.x, vp.y]
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
    const drag = dragRef.current;
    dragRef.current = null;
    setActiveHandle(null);

    // Corner snap: refine the dropped corner onto the card's true corner.
    // TCG cards have rounded corners, so we first try to intersect the two
    // straight edges adjacent to this corner (the virtual sharp corner the
    // rounded mask is built around); if that fails we fall back to a generic
    // sub-pixel corner refinement.
    if (drag && drag.kind.type === "corner") {
      const gray = grayRef.current;
      const index = drag.kind.index;
      if (gray) {
        const prev = corners[(index + 3) % 4];
        const next = corners[(index + 1) % 4];
        const snapped =
          snapCornerToCardEdges(
            gray,
            imageWidth,
            imageHeight,
            corners[index],
            prev,
            next
          ) ?? refineCorner(gray, imageWidth, imageHeight, corners[index]);
        if (snapped) {
          const next = cloneCorners(corners);
          next[index] = snapped;
          onChange(clampCorners(next, imageWidth, imageHeight));
          setSnapFlash(index);
          window.setTimeout(() => setSnapFlash((v) => (v === index ? null : v)), 450);
        }
      }
    }
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

  // Loupe lives on the SAME side as the focused handle, so your eye stays on the
  // corner you're adjusting. It is sized to fit comfortably on small screens.
  const loupeSize = Math.max(
    110,
    Math.min(160, Math.round(Math.min(box.width, box.height) * 0.42))
  );
  const loupeOnRight = focusDisplay ? focusDisplay.x >= box.width / 2 : false;
  const loupeOnBottom = focusDisplay ? focusDisplay.y >= box.height / 2 : false;

  const grabRadius = coarsePointer ? 24 : 16;
  const edgeBase = coarsePointer ? 9 : 7;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[200px] select-none touch-none overflow-hidden"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {fit.scale > 0 && (
        <img
          src={imageSrc}
          alt="Crop editor"
          style={{
            position: "absolute",
            width: imageWidth * fit.scale,
            height: imageHeight * fit.scale,
            left: fit.x - vp.x * fit.scale,
            top: fit.y - vp.y * fit.scale,
            maxWidth: "none",
            maxHeight: "none",
          }}
          className="pointer-events-none"
          draggable={false}
        />
      )}

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
            const s = isFocus ? edgeBase + 2 : edgeBase;
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
            const flashing = snapFlash === index;
            return (
              <g key={index}>
                {/* Snap confirmation pulse */}
                {flashing && (
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={20}
                    fill="none"
                    stroke="var(--color-handle-corner)"
                    strokeWidth={2}
                    className="anim-snap pointer-events-none"
                  />
                )}
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
                  r={grabRadius}
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
          size={loupeSize}
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
  size,
  onRight,
  onBottom,
}: {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  corners: CropCorners;
  cornerRadiusPx: number;
  focus: Point;
  size: number;
  onRight: boolean;
  onBottom: boolean;
}) {
  const c = size / 2;
  // Map an image-space point into the loupe's local coordinates.
  const toLoupe = (p: Point): Point => ({
    x: c + (p.x - focus.x) * LOUPE_ZOOM,
    y: c + (p.y - focus.y) * LOUPE_ZOOM,
  });

  const loupeCorners = corners.map(toLoupe) as CropCorners;
  const path = roundedCropPath(loupeCorners, cornerRadiusPx * LOUPE_ZOOM);
  const cross = Math.round(size * 0.08);

  return (
    <div
      className="absolute z-20 rounded-xl border border-border-strong shadow-2xl overflow-hidden pointer-events-none anim-fade"
      style={{
        width: size,
        height: size,
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
      <svg width={size} height={size} className="absolute inset-0">
        <path
          d={path}
          fill="var(--color-accent-soft)"
          stroke="var(--color-crop-stroke)"
          strokeWidth={1.5}
        />
        {/* Crosshair marking the exact handle position */}
        <line x1={c} y1={c - cross} x2={c} y2={c + cross} stroke="white" strokeWidth={1} opacity={0.9} />
        <line x1={c - cross} y1={c} x2={c + cross} y2={c} stroke="white" strokeWidth={1} opacity={0.9} />
        <circle cx={c} cy={c} r={2.5} fill="none" stroke="white" strokeWidth={1} />
      </svg>
    </div>
  );
}
