import { type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Loader2,
  ScanSearch,
} from "lucide-react";
import type { CaptureIssue, CenteringPreview } from "../../lib/api";
import type { Box } from "../../lib/centering";
import { GRADE_UPLOAD } from "../../lib/gradeUploadCopy";
import { StickyFooterBar } from "../pageLayout";
import {
  CaptureHints,
  CenteringPanel,
  CenteringPreviewPanel,
  GuideCentering,
  GuideGraders,
  GuideSidebar,
  GuideTips,
  ImageSlot,
  type CardSlot,
  type SideProc,
} from "./uploadParts";

type Slot = CardSlot | "angled_front" | "angled_back";

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
      <span className="text-xs sm:text-sm font-medium truncate">{label}</span>
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

function MobileGuideDisclosure() {
  return (
    <details className="xl:hidden rounded-xl border border-border-subtle bg-surface-raised overflow-hidden">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-text-primary border-b border-border-subtle/80 bg-surface-overlay/40">
        Need help with photos and centring?
      </summary>
      <div className="p-4 space-y-5">
        <GuideTips />
        <div className="border-t border-border-subtle pt-4">
          <GuideCentering />
        </div>
        <div className="border-t border-border-subtle pt-4">
          <GuideGraders />
        </div>
      </div>
    </details>
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
    <div className="space-y-8 pb-24 sm:pb-28">
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
            <StepBadge n={2} label="Centring" done={centeringMeasured} active={hasFront && !centeringMeasured} />
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
              title="Measure centring"
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

          <MobileGuideDisclosure />
        </div>

        <div className="hidden xl:block">
          <GuideSidebar />
        </div>
      </div>

      <StickyFooterBar>
        <div className="mx-auto flex w-full max-w-6xl flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
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
                "Confirm centring borders for best accuracy"
              )
            ) : (
              "Upload a front image to continue."
            )}
          </div>
          <div className="flex w-full sm:w-auto flex-col-reverse sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
            {outOfQuota && (
              <button
                onClick={buyGrade}
                disabled={buyBusy}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent/20 disabled:opacity-50 transition-colors w-full sm:w-auto"
              >
                {buyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {GRADE_UPLOAD.buyOne}
              </button>
            )}
            <button
              onClick={run}
              disabled={!hasFront || running || outOfQuota}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_24px_-6px_var(--color-accent)] hover:bg-accent-hover disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all w-full sm:w-auto"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
              {running ? GRADE_UPLOAD.checking : outOfQuota ? GRADE_UPLOAD.noCredits : GRADE_UPLOAD.runCheck}
            </button>
          </div>
        </div>
      </StickyFooterBar>
    </div>
  );
}
