import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CreditCard,
  ImagePlus,
  Loader2,
  UserCheck,
} from "lucide-react";
import { Field, FormError } from "../../components/auth/AuthLayout";
import { TurnstileField } from "../../components/TurnstileWidget";
import { useTurnstileToken } from "../../hooks/useTurnstile";
import {
  createHumanPregradeOrder,
  patchHumanPregradeDraft,
  uploadHumanPregradeImage,
  startHumanPregradeCheckout,
  submitHumanPregradeOrder,
} from "../api";
import type { HumanPregradeConfig } from "../api";
import { formatMinorUnits } from "../hooks/useHumanPregradeConfig";
import { safeStripeCheckoutUrl } from "../../lib/safeUrl";
import {
  graderLabel,
  hasErrors,
  initialFormFromParams,
  validateOrderStep,
  type OrderFormErrors,
  type OrderFormState,
} from "../validation/orderForm";

const STEPS = [
  { id: "card", label: "Card", icon: UserCheck },
  { id: "details", label: "Details", icon: UserCheck },
  { id: "photos", label: "Photos", icon: Camera },
  { id: "pay", label: "Review & pay", icon: CreditCard },
] as const;

function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-1 sm:gap-2">
      {STEPS.map((s, index) => {
        const done = index < step;
        const active = index === step;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-1 sm:gap-2 min-w-0">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                done
                  ? "bg-sky-500/20 text-sky-200"
                  : active
                    ? "bg-sky-500 text-white"
                    : "bg-surface-overlay text-text-muted"
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span
              className={`hidden truncate text-xs font-medium sm:block ${
                active ? "text-text-primary" : "text-text-muted"
              }`}
            >
              {s.label}
            </span>
            {index < STEPS.length - 1 ? (
              <div
                className={`mx-1 hidden h-px flex-1 sm:block ${done ? "bg-sky-500/40" : "bg-border-subtle"}`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-error">{message}</p>;
}

function ImageUploadField({
  label,
  hint,
  file,
  error,
  onChange,
}: {
  label: string;
  hint: string;
  file: File | null;
  error?: string;
  onChange: (file: File | null) => void;
}) {
  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file]
  );

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <div>
      <span className="block text-[12px] font-medium text-text-secondary mb-1.5">{label}</span>
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-6 transition-colors ${
          error
            ? "border-error/40 bg-error/5"
            : file
              ? "border-sky-500/30 bg-sky-500/5"
              : "border-border-strong bg-surface-overlay/40 hover:border-sky-500/30 hover:bg-surface-overlay/70"
        }`}
      >
        {preview ? (
          <img
            src={preview}
            alt=""
            className="max-h-40 w-auto rounded-lg border border-border-subtle object-contain"
          />
        ) : (
          <ImagePlus className="h-8 w-8 text-text-muted" />
        )}
        <div className="text-center">
          <p className="text-sm font-medium text-text-primary">
            {file ? file.name : "Choose an image"}
          </p>
          <p className="mt-1 text-xs text-text-muted">{hint}</p>
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          className="sr-only"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
      <FieldError message={error} />
    </div>
  );
}

export function HumanPregradeNewForm({ config }: { config: HumanPregradeConfig }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const turnstile = useTurnstileToken();
  const aiReportSnapshot = (location.state as { aiReportSnapshot?: Record<string, unknown> } | null)
    ?.aiReportSnapshot;

  const [step, setStep] = useState(0);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [form, setForm] = useState<OrderFormState>(() =>
    initialFormFromParams(params, config.graders[0]?.id)
  );
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<OrderFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!config.graders.length) return;
    setForm((f) => ({
      ...f,
      selectedGraderIds: f.selectedGraderIds.length
        ? f.selectedGraderIds
        : [config.graders[0]!.id],
    }));
  }, [config]);

  const price = formatMinorUnits(config.priceMinorUnits, config.currency);

  const toggleGrader = (id: string) => {
    setForm((f) => {
      const selected = f.selectedGraderIds.includes(id)
        ? f.selectedGraderIds.filter((g) => g !== id)
        : [...f.selectedGraderIds, id];
      return { ...f, selectedGraderIds: selected.length ? selected : [id] };
    });
  };

  const validateCurrentStep = () => {
    const errors = validateOrderStep(step, form, frontFile, backFile);
    setFieldErrors(errors);
    return !hasErrors(errors);
  };

  const goNext = () => {
    setError(null);
    if (!validateCurrentStep()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError(null);
    setFieldErrors({});
    if (step === 0) return;
    setStep((s) => s - 1);
  };

  const handleCheckout = async () => {
    setError(null);
    const allErrors = {
      ...validateOrderStep(0, form, frontFile, backFile),
      ...validateOrderStep(1, form, frontFile, backFile),
      ...validateOrderStep(2, form, frontFile, backFile),
      ...validateOrderStep(3, form, frontFile, backFile),
    };
    setFieldErrors(allErrors);
    if (hasErrors(allErrors)) {
      setError("Complete every required field before paying.");
      return;
    }
    if (!turnstile.ready) {
      setError("Complete the security check.");
      return;
    }
    if (!frontFile || !backFile) return;

    setBusy(true);
    try {
      const body: Record<string, unknown> = { ...form };
      if (params.get("aiReportId")) body.sourceAiReportId = params.get("aiReportId");
      if (aiReportSnapshot) body.aiReportSnapshot = aiReportSnapshot;

      let id = publicId;
      if (!id) {
        const { order } = await createHumanPregradeOrder(body);
        id = order.publicId as string;
        setPublicId(id);
      } else {
        await patchHumanPregradeDraft(id, form);
      }

      await uploadHumanPregradeImage(id, frontFile, "front");
      await uploadHumanPregradeImage(id, backFile, "back");

      const { url } = await startHumanPregradeCheckout(id, turnstile.token ?? undefined);
      const safe = safeStripeCheckoutUrl(url);
      if (!safe) {
        setError("Invalid checkout URL. Please try again or contact support.");
        turnstile.reset();
        return;
      }
      window.location.href = safe;
    } catch (e) {
      turnstile.reset();
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitAfterPayment = async () => {
    if (!publicId) return;
    setBusy(true);
    setError(null);
    try {
      await submitHumanPregradeOrder(publicId);
      navigate(`/human-pregrade/orders/${publicId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300/90">
            New request
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">{config.productName}</h1>
          <p className="mt-2 text-sm text-text-secondary">
            {price} · ~{config.expectedTurnaroundHours}h turnaround
          </p>
        </div>
        <Link
          to="/human-pregrade"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-text-muted transition hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="mb-8 rounded-2xl border border-border-subtle bg-surface-raised p-4 sm:p-5">
        <StepIndicator step={step} />
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-raised p-5 sm:p-6">
        <FormError message={error} />

        {step === 0 ? (
          <div className="space-y-4 anim-rise">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Card details</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Tell us which card the expert should review.
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-text-secondary">
                Card game
              </span>
              <select
                value={form.cardGame}
                onChange={(e) => setForm({ ...form, cardGame: e.target.value })}
                className="w-full rounded-lg border border-border-subtle bg-surface-overlay px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {(config.supportedCardGames.length
                  ? config.supportedCardGames
                  : ["Pokemon"]
                ).map((game) => (
                  <option key={game} value={game}>
                    {game}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.cardGame} />
            </label>

            <Field
              label="Card name"
              value={form.cardName}
              onChange={(v) => setForm({ ...form, cardName: v })}
              placeholder="e.g. Charizard"
              required
            />
            <FieldError message={fieldErrors.cardName} />

            <Field
              label="Set"
              value={form.setName}
              onChange={(v) => setForm({ ...form, setName: v })}
              placeholder="e.g. Base Set"
              required
            />
            <FieldError message={fieldErrors.setName} />

            <Field
              label="Card number"
              value={form.cardNumber}
              onChange={(v) => setForm({ ...form, cardNumber: v })}
              placeholder="e.g. 4/102"
              required
            />
            <FieldError message={fieldErrors.cardNumber} />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4 anim-rise">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">What should we focus on?</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Help the reviewer understand your goal and which graders matter to you.
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-text-secondary">
                Main concern <span className="text-error">*</span>
              </span>
              <textarea
                value={form.mainConcern}
                onChange={(e) => setForm({ ...form, mainConcern: e.target.value })}
                rows={4}
                placeholder="e.g. Considering PSA submission — worried about a light holo scratch on the front."
                className="w-full rounded-lg border border-border-subtle bg-surface-overlay px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <FieldError message={fieldErrors.mainConcern} />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-text-secondary">
                Additional notes <span className="text-text-muted">(optional)</span>
              </span>
              <textarea
                value={form.customerNotes}
                onChange={(e) => setForm({ ...form, customerNotes: e.target.value })}
                rows={3}
                placeholder="Anything else the expert should know."
                className="w-full rounded-lg border border-border-subtle bg-surface-overlay px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </label>

            <fieldset>
              <legend className="mb-2 text-[12px] font-medium text-text-secondary">
                Graders to include in the report
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {config.graders.map((grader) => {
                  const checked = form.selectedGraderIds.includes(grader.id);
                  return (
                    <label
                      key={grader.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                        checked
                          ? "border-sky-500/40 bg-sky-500/10"
                          : "border-border-subtle bg-surface-overlay/40 hover:bg-surface-overlay"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGrader(grader.id)}
                        className="rounded border-border-strong text-sky-500 focus:ring-sky-500"
                      />
                      <span className="text-sm font-medium text-text-primary">{grader.name}</span>
                    </label>
                  );
                })}
              </div>
              <FieldError message={fieldErrors.selectedGraderIds} />
            </fieldset>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5 anim-rise">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Upload photos</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Clear, well-lit front and back images. Avoid glare — the expert can request new
                photos if these aren&apos;t good enough.
              </p>
            </div>

            <ImageUploadField
              label="Front image"
              hint="JPEG, PNG or WebP · max 50 MB"
              file={frontFile}
              error={fieldErrors.frontFile}
              onChange={setFrontFile}
            />
            <ImageUploadField
              label="Back image"
              hint="JPEG, PNG or WebP · max 50 MB"
              file={backFile}
              error={fieldErrors.backFile}
              onChange={setBackFile}
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5 anim-rise">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Review & pay</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Check everything looks right, then pay securely to queue your expert review.
              </p>
            </div>

            <div className="rounded-xl border border-border-subtle bg-surface/60 p-4 text-sm">
              <dl className="space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-text-muted">Card</dt>
                  <dd className="text-right font-medium text-text-primary">
                    {form.cardName} · {form.setName} · {form.cardNumber}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-muted">Focus</dt>
                  <dd className="max-w-[16rem] text-right text-text-secondary">{form.mainConcern}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-muted">Graders</dt>
                  <dd className="text-right text-text-secondary">
                    {form.selectedGraderIds.map((id) => graderLabel(config, id)).join(", ")}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-muted">Photos</dt>
                  <dd className="text-right text-text-secondary">
                    {frontFile && backFile ? "Front & back attached" : "Missing images"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-border-subtle pt-2">
                  <dt className="font-medium text-text-primary">Total</dt>
                  <dd className="text-lg font-semibold tabular-nums text-text-primary">{price}</dd>
                </div>
              </dl>
            </div>

            <p className="text-xs leading-relaxed text-text-muted">{config.customerDisclaimer}</p>

            <label className="flex items-start gap-2.5 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={form.trainingConsent}
                onChange={(e) => setForm({ ...form, trainingConsent: e.target.checked })}
                className="mt-1 rounded border-border-strong"
              />
              {config.trainingConsentWording || "Optional: allow anonymised use to improve our review quality."}
            </label>

            <label className="flex items-start gap-2.5 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={form.termsAccepted}
                onChange={(e) => setForm({ ...form, termsAccepted: e.target.checked })}
                className="mt-1 rounded border-border-strong"
              />
              I understand this is a human pre-grading opinion based on photos — not official
              grading or authentication.
            </label>
            <FieldError message={fieldErrors.termsAccepted} />

            <TurnstileField {...turnstile} />

            <button
              type="button"
              disabled={!form.termsAccepted || !turnstile.ready || busy}
              onClick={handleCheckout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing checkout…
                </>
              ) : (
                <>
                  Pay {price} & continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            {publicId ? (
              <button
                type="button"
                className="block w-full text-center text-sm text-sky-300 hover:text-sky-200"
                onClick={handleSubmitAfterPayment}
                disabled={busy}
              >
                Already paid? Submit order
              </button>
            ) : null}
          </div>
        ) : null}

        {step < 3 ? (
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border-subtle pt-6">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary disabled:invisible"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mt-8 border-t border-border-subtle pt-6">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
