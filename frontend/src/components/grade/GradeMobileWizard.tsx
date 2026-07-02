import { useEffect, useMemo, useRef } from "react";
import {
  ChevronRight,
  CreditCard,
  Loader2,
  ScanSearch,
} from "lucide-react";
import { MobileStepFlow } from "../pageLayout";
import { useWizardSteps, type WizardStep } from "../../hooks/useWizardSteps";
import { GRADE_UPLOAD, GRADE_WIZARD } from "../../lib/gradeUploadCopy";
import {
  CaptureHints,
  CenteringPanel,
  CenteringPreviewPanel,
  GuideCentering,
  GuideGraders,
  GuideTips,
  ImageSlot,
} from "./uploadParts";
import type { GradeUploadWorkspaceProps } from "./GradeUploadWorkspace";

type StepId = "front" | "front-centring" | "extras" | "back-centring" | "review";

function sideMeasured(
  outer: unknown,
  inner: unknown,
  skipped: boolean
): boolean {
  return skipped || (outer != null && inner != null);
}

export function GradeMobileWizard({
  quotaLabel,
  purchaseBanner,
  files,
  previews,
  setSlot,
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
  error,
  captureBlockers,
  outOfQuota,
  buyBusy,
  buyGrade,
  running,
  run,
  prefilled = false,
}: GradeUploadWorkspaceProps & { prefilled?: boolean }) {
  const hasFront = Boolean(files.front);
  const hasBack = Boolean(files.back);
  const frontReady = hasFront && !proc.front.loading;
  const frontMeasured = sideMeasured(outers.front, inners.front, skip.front);
  const backMeasured = sideMeasured(outers.back, inners.back, skip.back);
  const hasExtras =
    hasBack ||
    Boolean(files.angled_front) ||
    Boolean(files.angled_back) ||
    closeups.length > 0;

  const steps = useMemo<(WizardStep & { id: StepId })[]>(
    () => [
      { id: "front", label: GRADE_WIZARD.front.label, canAdvance: frontReady },
      {
        id: "front-centring",
        label: GRADE_WIZARD.frontCentring.label,
        canAdvance: !proc.front.loading && frontMeasured,
      },
      { id: "extras", label: GRADE_WIZARD.extras.label, canAdvance: true },
      {
        id: "back-centring",
        label: GRADE_WIZARD.backCentring.label,
        canAdvance: !proc.back.loading && backMeasured,
        hidden: !hasBack,
      },
      { id: "review", label: GRADE_WIZARD.review.label, canAdvance: true },
    ],
    [frontReady, frontMeasured, backMeasured, hasBack, proc.front.loading, proc.back.loading]
  );

  const wizard = useWizardSteps({
    steps,
    initialStepId: prefilled ? "front-centring" : "front",
  });

  // After the front straightens, move the user straight into centring.
  const prevFrontLoading = useRef(proc.front.loading);
  useEffect(() => {
    const finished = prevFrontLoading.current && !proc.front.loading;
    prevFrontLoading.current = proc.front.loading;
    if (finished && wizard.step.id === "front" && hasFront) {
      wizard.next();
    }
  }, [proc.front.loading, hasFront, wizard]);

  const stepId = wizard.step.id as StepId;

  const copy =
    stepId === "front"
      ? GRADE_WIZARD.front
      : stepId === "front-centring"
        ? GRADE_WIZARD.frontCentring
        : stepId === "extras"
          ? GRADE_WIZARD.extras
          : stepId === "back-centring"
            ? GRADE_WIZARD.backCentring
            : GRADE_WIZARD.review;

  const isReview = stepId === "review";
  const primaryLabel = isReview
    ? running
      ? GRADE_UPLOAD.checking
      : outOfQuota
        ? GRADE_UPLOAD.noCredits
        : GRADE_UPLOAD.runCheck
    : stepId === "extras" && !hasExtras
      ? GRADE_WIZARD.extras.skip
      : "Continue";

  const primaryDisabled = isReview ? running || outOfQuota : !wizard.canAdvance;
  const primaryIcon = isReview ? (
    running ? (
      <Loader2 className="w-4 h-4 animate-spin" />
    ) : (
      <ScanSearch className="w-4 h-4" />
    )
  ) : (
    <ChevronRight className="w-4 h-4" />
  );

  const onPrimary = () => {
    if (isReview) run();
    else wizard.next();
  };

  const banner = (
    <>
      {(stepId === "front" || isReview) && quotaLabel ? (
        <div className="mb-3 flex justify-end">{quotaLabel}</div>
      ) : null}
      {stepId === "front" ? purchaseBanner : null}
    </>
  );

  const secondary =
    isReview && outOfQuota ? (
      <button
        onClick={buyGrade}
        disabled={buyBusy}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent/20 disabled:opacity-50 transition-colors"
      >
        {buyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
        {GRADE_UPLOAD.buyOne}
      </button>
    ) : null;

  return (
    <MobileStepFlow
      wizard={wizard}
      title={copy.title}
      subtitle={copy.subtitle}
      banner={banner}
      primaryLabel={primaryLabel}
      onPrimary={onPrimary}
      primaryDisabled={primaryDisabled}
      primaryIcon={primaryIcon}
      secondary={secondary}
    >
      {stepId === "front" && (
        <div className="space-y-5">
          <div className="mx-auto w-full max-w-[16rem]">
            <ImageSlot
              label={GRADE_UPLOAD.frontLabel}
              required
              preview={previews.front}
              onPick={(f) => setSlot("front", f)}
              onClear={() => setSlot("front", null)}
            />
          </div>
          {outOfQuota && (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/90">
              You have no grade checks left. You can still line everything up now — you'll be able
              to buy a single check on the final step.
            </p>
          )}
          {localCaptureHints.length > 0 && <CaptureHints issues={localCaptureHints} />}
          <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
            <GuideTips />
          </div>
        </div>
      )}

      {stepId === "front-centring" && (
        <div className="space-y-4">
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
          {centeringPreview && <CenteringPreviewPanel preview={centeringPreview} />}
          <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
            <GuideCentering />
          </div>
        </div>
      )}

      {stepId === "extras" && (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium text-text-secondary mb-2">
              Back of card — recommended for gem-grade calls and subgrades
            </p>
            <div className="mx-auto w-full max-w-[16rem]">
              <ImageSlot
                label={GRADE_UPLOAD.backLabel}
                preview={previews.back}
                onPick={(f) => setSlot("back", f)}
                onClear={() => setSlot("back", null)}
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary mb-2">
              Angled holo shots — reveal shine, print lines and scratches
            </p>
            <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary mb-2">
              Close-ups of specific flaws (up to 4)
            </p>
            <div className="grid grid-cols-4 gap-2">
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

      {stepId === "back-centring" && (
        <div className="space-y-4">
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
          {centeringPreview && <CenteringPreviewPanel preview={centeringPreview} />}
          <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
            <GuideCentering />
          </div>
        </div>
      )}

      {isReview && (
        <div className="space-y-4">
          <ul className="rounded-xl border border-border-subtle bg-surface-raised divide-y divide-border-subtle">
            <ReviewRow
              label="Front photo"
              value={hasFront ? "Added" : "Missing"}
              ok={hasFront}
              onEdit={() => wizard.goTo("front")}
            />
            <ReviewRow
              label="Front centring"
              value={skip.front ? "Skipped (no border)" : frontMeasured ? "Measured" : "Not measured"}
              ok={frontMeasured}
              onEdit={() => wizard.goTo("front-centring")}
            />
            <ReviewRow
              label="Extra photos"
              value={hasExtras ? "Added" : "None"}
              ok
              onEdit={() => wizard.goTo("extras")}
            />
            {hasBack && (
              <ReviewRow
                label="Back centring"
                value={skip.back ? "Skipped (no border)" : backMeasured ? "Measured" : "Not measured"}
                ok={backMeasured}
                onEdit={() => wizard.goTo("back-centring")}
              />
            )}
          </ul>

          {localCaptureHints.length > 0 && <CaptureHints issues={localCaptureHints} />}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 space-y-2">
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

          <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
            <h3 className="text-xs uppercase tracking-wide text-text-muted mb-3">
              How graders differ
            </h3>
            <GuideGraders />
          </div>
        </div>
      )}
    </MobileStepFlow>
  );
}

function ReviewRow({
  label,
  value,
  ok,
  onEdit,
}: {
  label: string;
  value: string;
  ok?: boolean;
  onEdit: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        <div className={`text-xs ${ok ? "text-text-secondary" : "text-amber-300/90"}`}>{value}</div>
      </div>
      <button
        onClick={onEdit}
        className="shrink-0 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
      >
        Change
      </button>
    </li>
  );
}
