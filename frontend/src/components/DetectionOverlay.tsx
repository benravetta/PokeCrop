import { useMemo } from "react";

type Point = { x: number; y: number };

function parseCorners(raw: number[][] | undefined, width: number, height: number): Point[] | null {
  if (!raw || raw.length !== 4) return null;
  const pts = raw.map(([x, y]) => ({ x, y }));
  if (pts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const maxX = Math.max(...pts.map((p) => p.x));
  const maxY = Math.max(...pts.map((p) => p.y));
  const scaleX = maxX > width * 1.05 ? width / Math.max(width, maxX) : 1;
  const scaleY = maxY > height * 1.05 ? height / Math.max(height, maxY) : 1;
  const s = Math.min(scaleX, scaleY);
  return pts.map((p) => ({ x: p.x * s, y: p.y * s }));
}

export function DetectionOverlay({
  width,
  height,
  corners,
  className = "",
}: {
  width: number;
  height: number;
  corners?: number[][];
  className?: string;
}) {
  const pts = useMemo(() => parseCorners(corners, width, height), [corners, width, height]);
  if (!pts || width <= 0 || height <= 0) return null;

  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <path d={d} fill="rgba(56, 189, 248, 0.12)" stroke="rgba(56, 189, 248, 0.95)" strokeWidth={3} />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={6} fill="#38bdf8" stroke="#0f172a" strokeWidth={2} />
      ))}
    </svg>
  );
}
