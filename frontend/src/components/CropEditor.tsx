import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampCorners,
  cloneCorners,
  CropCorners,
  edgeMidpoint,
  EdgeId,
  moveEdge,
  roundedCropPath,
} from "../lib/cropGeometry";

type HandleKind = { type: "corner"; index: number } | { type: "edge"; edge: EdgeId };

interface CropEditorProps {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  corners: CropCorners;
  cornerRadiusPx: number;
  onChange: (corners: CropCorners) => void;
}

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
    (p: { x: number; y: number }) => ({
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
  };

  const displayCorners = corners.map(toDisplay) as CropCorners;
  const path = roundedCropPath(displayCorners, cornerRadiusPx * fit.scale);
  const edges: EdgeId[] = ["top", "right", "bottom", "left"];

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
            return (
              <rect
                key={edge}
                x={mid.x - 7}
                y={mid.y - 7}
                width={14}
                height={14}
                rx={3}
                fill="var(--color-handle-edge)"
                stroke="white"
                strokeWidth={1}
                className="cursor-move pointer-events-auto"
                onPointerDown={onPointerDown({ type: "edge", edge })}
              />
            );
          })}

          {corners.map((pt, index) => {
            const d = toDisplay(pt);
            return (
              <circle
                key={index}
                cx={d.x}
                cy={d.y}
                r={8}
                fill="var(--color-handle-corner)"
                stroke="white"
                strokeWidth={1.5}
                className="cursor-grab active:cursor-grabbing pointer-events-auto"
                onPointerDown={onPointerDown({ type: "corner", index })}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
