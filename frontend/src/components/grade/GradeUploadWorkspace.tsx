import { useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  CreditCard,
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
import { GRADE_UPLOAD } from "../../lib/gradeUploadCopy";

type CardSlot = "front" | "back";
type Slot = CardSlot | "angled_front" | "angled_back";

interface SideProc {
  src?: string;
  loading: boolean;
  failed: boolean;
}

function StepBadge({
  n,
  label,
  done,
  active,
}: {
  n: number;
  label: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 min-w-0 ${
        active ? "text-text-primary" : done ? "text-text-secondary" : "text-text-muted"
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
          done
            ? "bg-success/20 text-success"
            : active
              ? "bg-accent text-white shadow-[0_0_20px_-4px_var(--color-accent)]"
              : "bg-surface-overlay text-text-muted"
        }`}
      >
        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : n}
      </span>
      <span className="text-sm font-medium truncate hidden sm:inline">{label}</span>
    </div>
  );
}

function Panel({
  step,
  title,
  description,
  children,
  className = "",
}: {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-border-subtle bg-surface-raised overflow-hidden anim-rise ${className}`}
      style={{ animationDelay: `${step * 60}ms` }}
    >
      <div className="flex items-start gap-3 border-b border-border-subtle px-5 py-4 bg-surface-overlay/30">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent text-sm font-semibold">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-text-secondary leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ImageSlot({
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

function CaptureHints({ issues }: { issues: CaptureIssue[] }) {
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

type GuideTab = "tips" | "centering" | "graders";

function GuideSidebar() {
  const [tab, setTab] = useState<GuideTab>("tips");
  const tabs: { id: GuideTab; label: string }[] = [
    { id: "tips", label: "Photo tips" },
    { id: "centering", label: "Centering" },
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

function GuideTips() {
  const tips = [
    { icon: Camera, t: "Full resolution", d: "Camera originals only — no screenshots or re-shared images." },
    { icon: Square, t: "Bare & flat", d: "Out of sleeve/toploader. Holos curl and skew centering reads." },
    { icon: ScanSearch, t: "Square-on", d: "Fill the frame, tap to focus, even light without glare." },
    { icon: Layers, t: "Front + back", d: "Both sides for gem-grade confidence and back subgrades." },
  ];
  const checks = [
    { icon: ScanSearch, t: "Centering", d: "Border evenness, front and back." },
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

function GuideCentering() {
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

function GuideGraders() {
  const rows = [
    ["PSA", "Whole 1–10. Gem 10 needs tight front centering."],
    ["Beckett", "Half grades + subs. Black Label = all 10s."],
    ["CGC", "Half grades, strict on the weakest sub."],
    ["TAG", "One-decimal CV score, tight centering bands."],
    ["ACE", "One-decimal AI grade with published centering caps."],
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

function CenteringPreviewPanel({ preview }: { preview: CenteringPreview }) {
  const capLabel =
    preview.grade_cap !== "none" && preview.grade_cap_value != null
      ? `${preview.grade_cap === "hard" ? "Hard" : "Soft"} cap ~${preview.grade_cap_value}`
      : null;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-overlay/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle/80 bg-surface-overlay/50">
        <h3 className="text-sm font-medium text-text-primary">Centering preview (PSA baseline)</h3>
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

function CenteringPanel({
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

export interface GradeUploadWorkspaceProps {
  quotaLabel: ReactNode;
  purchaseBanner: ReactNode;
  files: Record<Slot, File | null>;
  previews: Record<string, string>;
  setSlot: (slot: Slot, file: File | null) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean | ((prev: boolean) => boolean)) => void;
  closeups: File[];
  closeupPreviews: string[];
  addCloseup: (f: File) => void;
  removeCloseup: (i: number) => void;
  proc: Record<CardSlot, SideProc>;
  outers: Record<CardSlot, Box | null>;
  inners: Record<CardSlot, Box | null>;
  skip: Record<CardSlot, boolean>;
  setOuters: React.Dispatch<React.SetStateAction<Record<CardSlot, Box | null>>>;
  setInners: React.Dispatch<React.SetStateAction<Record<CardSlot, Box | null>>>;
  setSkip: React.Dispatch<React.SetStateAction<Record<CardSlot, boolean>>>;
  onCenteringAutoDetect?: (side: CardSlot, outer: Box, inner: Box) => void;
  centeringPreview?: CenteringPreview | null;
  localCaptureHints: CaptureIssue[];
  centeringMeasured: boolean;
  error: string | null;
  captureBlockers: CaptureIssue[];
  outOfQuota: boolean;
  buyBusy: boolean;
  buyGrade: () => void;
  running: boolean;
  run: () => void;
}

export function GradeUploadWorkspace({
  quotaLabel,
  purchaseBanner,
  files,
  previews,
  setSlot,
  showAdvanced,
  setShowAdvanced,
  closeups,
  closeupPreviews,
  addCloseup,
  removeCloseup,
  proc,
  outers,
  inners,
  skip,
  setOuters,
  setInners,
  setSkip,
  onCenteringAutoDetect,
  centeringPreview,
  localCaptureHints,
  centeringMeasured,
  error,
  captureBlockers,
  outOfQuota,
  buyBusy,
  buyGrade,
  running,
  run,
}: GradeUploadWorkspaceProps) {
  const hasFront = Boolean(files.front);
  const hasBack = Boolean(files.back);
  const straightening = proc.front.loading || proc.back.loading;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border-subtle anim-rise">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/12 via-surface-raised to-surface-raised" />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative px-6 py-7 sm:px-8 sm:py-9">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent mb-3">
                Pre-grade check
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
                {GRADE_UPLOAD.pageHeading}
              </h1>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed max-w-lg">
                {GRADE_UPLOAD.intro}
              </p>
            </div>
            {quotaLabel}
          </div>
          {purchaseBanner}
          {/* Step rail */}
          <div className="mt-6 flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1">
            <StepBadge n={1} label="Upload" done={hasFront} active={!hasFront} />
            <div className="h-px w-6 sm:w-10 shrink-0 bg-border-strong" />
            <StepBadge n={2} label="Center" done={centeringMeasured} active={hasFront && !centeringMeasured} />
            <div className="h-px w-6 sm:w-10 shrink-0 bg-border-strong" />
            <StepBadge n={3} label="Report" active={hasFront && centeringMeasured} />
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_300px] gap-6 lg:gap-8 items-start">
        <div className="space-y-6 min-w-0">
          <Panel
            step={1}
            title="Upload your photos"
            description={`${GRADE_UPLOAD.frontHelp} The front photo is required.`}
          >
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
              <ImageSlot
                label={GRADE_UPLOAD.frontLabel}
                required
                preview={previews.front}
                onPick={(f) => setSlot("front", f)}
                onClear={() => setSlot("front", null)}
              />
              <ImageSlot
                label={GRADE_UPLOAD.backLabel}
                preview={previews.back}
                onPick={(f) => setSlot("back", f)}
                onClear={() => setSlot("back", null)}
              />
            </div>

            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              Optional: angled holo shots & close-ups
            </button>
            {showAdvanced && (
              <div className="mt-4 pt-4 border-t border-border-subtle space-y-4 anim-rise">
                <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
                  <ImageSlot
                    label="Angled front"
                    compact
                    preview={previews.angled_front}
                    onPick={(f) => setSlot("angled_front", f)}
                    onClear={() => setSlot("angled_front", null)}
                  />
                  <ImageSlot
                    label="Angled back"
                    compact
                    preview={previews.angled_back}
                    onPick={(f) => setSlot("angled_back", f)}
                    onClear={() => setSlot("angled_back", null)}
                  />
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-2">Close-ups of flaws (up to 4)</p>
                  <div className="grid grid-cols-4 gap-2 max-w-md">
                    {closeups.map((_, i) => (
                      <ImageSlot
                        key={i}
                        label={`#${i + 1}`}
                        compact
                        preview={closeupPreviews[i]}
                        onPick={() => {}}
                        onClear={() => removeCloseup(i)}
                      />
                    ))}
                    {closeups.length < 4 && (
                      <ImageSlot label="Add" compact onPick={addCloseup} onClear={() => {}} />
                    )}
                  </div>
                </div>
              </div>
            )}

            {localCaptureHints.length > 0 && (
              <div className="mt-4">
                <CaptureHints issues={localCaptureHints} />
              </div>
            )}
          </Panel>

          {hasFront && (
            <Panel
              step={2}
              title="Measure centering"
              description="Confirm the outer card edge and inner artwork border on each straightened photo."
            >
              <div className={`grid gap-4 ${hasBack ? "xl:grid-cols-2" : ""}`}>
                <CenteringPanel
                  side="front"
                  label="Front"
                  proc={proc.front}
                  displaySrc={proc.front.src ?? previews.front}
                  outer={outers.front}
                  inner={inners.front}
                  onOuter={(b) => setOuters((prev) => ({ ...prev, front: b }))}
                  onInner={(b) => setInners((prev) => ({ ...prev, front: b }))}
                  skip={skip.front}
                  onSkip={(v) => setSkip((s) => ({ ...s, front: v }))}
                  onAutoDetect={onCenteringAutoDetect}
                />
                {hasBack && (
                  <CenteringPanel
                    side="back"
                    label="Back"
                    proc={proc.back}
                    displaySrc={proc.back.src ?? previews.back}
                    outer={outers.back}
                    inner={inners.back}
                    onOuter={(b) => setOuters((prev) => ({ ...prev, back: b }))}
                    onInner={(b) => setInners((prev) => ({ ...prev, back: b }))}
                    skip={skip.back}
                    onSkip={(v) => setSkip((s) => ({ ...s, back: v }))}
                    onAutoDetect={onCenteringAutoDetect}
                  />
                )}
              </div>
              {centeringPreview && <CenteringPreviewPanel preview={centeringPreview} />}
            </Panel>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 space-y-2 anim-rise">
              <p>{error}</p>
              {captureBlockers.length > 0 && (
                <ul className="list-disc pl-5 text-red-200/90 text-xs space-y-1">
                  {captureBlockers.map((i) => (
                    <li key={i.code}>{i.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <GuideSidebar />
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 border-t border-border-subtle bg-surface/90 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 max-w-6xl mx-auto">
          <div className="text-xs text-text-muted min-w-0">
            {straightening ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                Straightening card…
              </span>
            ) : hasFront ? (
              centeringMeasured ? (
                <span className="text-success inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {GRADE_UPLOAD.readyState}
                </span>
              ) : (
                "Confirm centering borders for best accuracy"
              )
            ) : (
              "Upload a front image to continue."
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {outOfQuota && (
              <button
                onClick={buyGrade}
                disabled={buyBusy}
                className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent/20 disabled:opacity-50 transition-colors"
              >
                {buyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {GRADE_UPLOAD.buyOne}
              </button>
            )}
            <button
              onClick={run}
              disabled={!hasFront || running || outOfQuota}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_24px_-6px_var(--color-accent)] hover:bg-accent-hover disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
              {running ? GRADE_UPLOAD.checking : outOfQuota ? GRADE_UPLOAD.noCredits : GRADE_UPLOAD.runCheck}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
