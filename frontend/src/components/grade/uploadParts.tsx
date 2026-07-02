import { useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Crop,
  Layers,
  Loader2,
  ScanSearch,
  Square,
  Upload,
  X,
} from "lucide-react";
import { CenteringTool } from "./CenteringTool";
import type { CaptureIssue, CenteringPreview } from "../../lib/api";
import type { Box } from "../../lib/centering";

export type CardSlot = "front" | "back";

export interface SideProc {
  src?: string;
  loading: boolean;
  failed: boolean;
}

export function ImageSlot({
  label,
  preview,
  required,
  compact,
  onPick,
  onClear,
}: {
  label: string;
  preview?: string;
  required?: boolean;
  compact?: boolean;
  onPick: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative group">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif,image/x-adobe-dng,.heic,.heif,.dng"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      {preview ? (
        <div
          className={`relative overflow-hidden rounded-xl border border-accent/30 bg-surface-overlay shadow-[inset_0_0_0_1px_rgba(124,108,246,0.15)] ${
            compact ? "aspect-square" : "aspect-[5/7]"
          }`}
        >
          <img src={preview} alt={label} className="h-full w-full object-contain p-1" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
            <span className="text-xs font-medium text-white/90">{label}</span>
          </div>
          <button
            onClick={onClear}
            className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white opacity-0 group-hover:opacity-100 hover:bg-black/90 transition-opacity"
            aria-label={`Remove ${label}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className={`flex w-full flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed transition-all duration-200 ${
            compact ? "aspect-square p-3" : "aspect-[5/7] p-4"
          } border-border-strong bg-surface-overlay/50 text-text-secondary hover:border-accent/60 hover:bg-accent/5 hover:text-text-primary`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-overlay group-hover:bg-accent/10 transition-colors">
            <Upload className="w-5 h-5" />
          </span>
          <span className="text-xs font-medium text-center leading-snug px-1">{label}</span>
          {required && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              Required
            </span>
          )}
        </button>
      )}
    </div>
  );
}

export function CaptureHints({ issues }: { issues: CaptureIssue[] }) {
  const blocks = issues.filter((i) => i.severity === "block");
  const warns = issues.filter((i) => i.severity === "warn");
  const block = blocks.length > 0;
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm space-y-2 ${
        block
          ? "border-red-500/30 bg-red-500/10 text-red-200"
          : "border-amber-500/25 bg-amber-500/8 text-amber-100/90"
      }`}
    >
      <div className="flex items-center gap-2 font-medium text-[13px]">
        <Camera className="w-4 h-4 shrink-0" />
        {block ? "Fix these before grading" : "Photo quality notes"}
      </div>
      <ul className="space-y-1.5 text-xs leading-relaxed opacity-90">
        {[...blocks, ...warns].map((i) => (
          <li key={i.code} className="flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-70" />
            <span>{i.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type GuideTab = "tips" | "centering" | "graders";

export function GuideSidebar() {
  const [tab, setTab] = useState<GuideTab>("tips");
  const tabs: { id: GuideTab; label: string }[] = [
    { id: "tips", label: "Photo tips" },
    { id: "centering", label: "Centring" },
    { id: "graders", label: "Graders" },
  ];

  return (
    <aside className="rounded-2xl border border-border-subtle bg-surface-raised overflow-hidden lg:sticky lg:top-4 anim-rise">
      <div className="flex border-b border-border-subtle bg-surface-overlay/40">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-2 py-3 text-[11px] sm:text-xs font-medium transition-colors ${
              tab === t.id
                ? "text-accent border-b-2 border-accent bg-accent/5"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-5 max-h-[min(520px,70vh)] overflow-y-auto">
        {tab === "tips" && <GuideTips />}
        {tab === "centering" && <GuideCentering />}
        {tab === "graders" && <GuideGraders />}
      </div>
    </aside>
  );
}

export function GuideTips() {
  const tips = [
    { icon: Camera, t: "Full resolution", d: "Camera originals only — no screenshots or re-shared images." },
    { icon: Square, t: "Bare & flat", d: "Out of sleeve/toploader. Holos curl and skew centring reads." },
    { icon: ScanSearch, t: "Square-on", d: "Fill the frame, tap to focus, even light without glare." },
    { icon: Layers, t: "Front + back", d: "Both sides for gem-grade confidence and back subgrades." },
  ];
  const checks = [
    { icon: ScanSearch, t: "Centring", d: "Border evenness, front and back." },
    { icon: Square, t: "Corners", d: "Whitening, dents, rounding." },
    { icon: Crop, t: "Edges", d: "Chips, nicks, rough cuts." },
    { icon: Layers, t: "Surface", d: "Scratches, print lines, creases." },
  ];
  return (
    <div className="space-y-5">
      <ul className="space-y-3">
        {tips.map((r) => (
          <li key={r.t} className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15">
              <r.icon className="w-4 h-4 text-accent" />
            </span>
            <div>
              <div className="text-sm font-medium text-text-primary">{r.t}</div>
              <div className="text-xs text-text-secondary mt-0.5 leading-relaxed">{r.d}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-border-subtle pt-4">
        <div className="text-[11px] uppercase tracking-wide text-text-muted mb-3">What we inspect</div>
        <ul className="grid grid-cols-2 gap-2">
          {checks.map((r) => (
            <li
              key={r.t}
              className="rounded-lg bg-surface-overlay/60 px-2.5 py-2 border border-border-subtle/80"
            >
              <div className="text-xs font-medium text-text-primary">{r.t}</div>
              <div className="text-[11px] text-text-muted mt-0.5 leading-snug">{r.d}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CenterEg({ dx, dy, label, ok }: { dx: number; dy: number; label: string; ok: "good" | "ok" | "bad" }) {
  const tone =
    ok === "good" ? "fill-emerald-400/30" : ok === "ok" ? "fill-accent/30" : "fill-amber-400/30";
  const stroke =
    ok === "good" ? "stroke-emerald-400" : ok === "ok" ? "stroke-accent" : "stroke-amber-400";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 60 84" className="w-12 h-[4rem]">
        <rect x="1" y="1" width="58" height="82" rx="4" className="fill-surface-overlay stroke-border-strong" strokeWidth="1.5" />
        <rect x={14 + dx} y={14 + dy} width="32" height="56" rx="2" className={`${tone} ${stroke}`} strokeWidth="1.5" />
      </svg>
      <span className="text-[10px] text-text-secondary">{label}</span>
    </div>
  );
}

export function GuideCentering() {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-text-secondary text-xs leading-relaxed">
        We compare opposite border widths. The worst axis sets the ceiling — Beckett and TAG are
        stricter than PSA at the top end.
      </p>
      <div className="flex items-end justify-between gap-1">
        <CenterEg dx={0} dy={0} label="50/50" ok="good" />
        <CenterEg dx={5} dy={2} label="60/40" ok="ok" />
        <CenterEg dx={10} dy={4} label="70/30" ok="bad" />
      </div>
      <div className="rounded-xl bg-surface-overlay/60 p-3 flex gap-3 border border-border-subtle/80">
        <svg viewBox="0 0 60 84" className="w-11 shrink-0">
          <rect x="1" y="1" width="58" height="82" rx="4" className="fill-surface stroke-border-strong" strokeWidth="1.5" />
          <rect x="12" y="12" width="36" height="60" rx="2" className="fill-accent/20 stroke-accent" strokeWidth="1.5" />
          <line x1="1" y1="42" x2="12" y2="42" className="stroke-accent" strokeWidth="1.5" />
          <line x1="48" y1="42" x2="59" y2="42" className="stroke-accent" strokeWidth="1.5" />
        </svg>
        <p className="text-xs text-text-secondary leading-relaxed">
          Dashed = card edge. Solid = artwork border. We measure the band between them on each side.
        </p>
      </div>
    </div>
  );
}

export function GuideGraders() {
  const rows = [
    ["PSA", "Whole 1–10. Gem 10 needs tight front centring."],
    ["Beckett", "Half grades + subs. Black Label = all 10s."],
    ["CGC", "Half grades, strict on the weakest sub."],
    ["TAG", "One-decimal CV score, tight centring bands."],
    ["ACE", "One-decimal AI grade with published centring caps."],
  ];
  return (
    <div>
      <ul className="space-y-3">
        {rows.map(([k, v]) => (
          <li key={k} className="flex gap-3">
            <span className="w-14 shrink-0 text-xs font-bold text-accent">{k}</span>
            <span className="text-xs text-text-secondary leading-relaxed">{v}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-text-muted leading-relaxed">
        Estimates only — official grades come from each company after handling the physical card.
      </p>
    </div>
  );
}

export function CenteringPreviewPanel({ preview }: { preview: CenteringPreview }) {
  const capLabel =
    preview.grade_cap !== "none" && preview.grade_cap_value != null
      ? `${preview.grade_cap === "hard" ? "Hard" : "Soft"} cap ~${preview.grade_cap_value}`
      : null;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-overlay/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle/80 bg-surface-overlay/50">
        <h3 className="text-sm font-medium text-text-primary">Centring preview (PSA baseline)</h3>
        <p className="mt-1 text-xs text-text-secondary leading-relaxed">{preview.explanation}</p>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-surface-overlay px-2.5 py-1 text-text-secondary">
            Confidence {Math.round(preview.measurement_confidence * 100)}%
          </span>
          {capLabel && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-200/90">
              {capLabel}
            </span>
          )}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {preview.hints
            .filter((h) => h.label)
            .map((h) => (
              <li
                key={h.grader}
                className="rounded-lg border border-border-subtle/80 bg-surface-overlay/30 px-3 py-2 text-xs text-text-secondary"
              >
                <span className="font-medium text-text-primary">{h.grader}</span>
                <span className="mx-1.5 text-text-muted">·</span>
                {h.label}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

export function CenteringPanel({
  side,
  label,
  proc,
  displaySrc,
  outer,
  inner,
  onOuter,
  onInner,
  skip,
  onSkip,
  onAutoDetect,
}: {
  side: CardSlot;
  label: string;
  proc: SideProc;
  displaySrc?: string;
  outer: Box | null;
  inner: Box | null;
  onOuter: (b: Box) => void;
  onInner: (b: Box) => void;
  skip: boolean;
  onSkip: (v: boolean) => void;
  onAutoDetect?: (side: CardSlot, outer: Box, inner: Box) => void;
}) {
  if (!displaySrc && !proc.loading) return null;
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-overlay/40 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border-subtle/80 bg-surface-overlay/50">
        <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
          <ScanSearch className="w-4 h-4 text-accent" />
          {label}
        </h3>
        {proc.loading && (
          <span className="text-xs text-text-muted inline-flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Straightening…
          </span>
        )}
      </div>
      <div className="p-3">
        {proc.loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
            <Loader2 className="w-5 h-5 animate-spin text-accent" />
            Detecting card edges…
          </div>
        ) : displaySrc ? (
          <>
            {proc.failed && (
              <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-200/90">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Couldn't auto-straighten — adjust borders manually or tick "No border".
              </p>
            )}
            <CenteringTool
              side={side}
              imageSrc={displaySrc}
              outer={outer}
              inner={inner}
              onOuter={onOuter}
              onInner={onInner}
              skipped={skip}
              onSkip={onSkip}
              onAutoDetect={
                onAutoDetect ? (o, i) => onAutoDetect(side, o, i) : undefined
              }
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
