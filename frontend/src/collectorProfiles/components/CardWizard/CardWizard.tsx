import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  createCollectorCard,
  fetchCollectorCard,
  identifyCollectorCard,
  patchCollectorCard,
  publishCollectorCard,
} from "../../api";
import { EMPTY_DRAFT, type CollectorCardDraft, type WizardStep } from "./types";
import { AutofillPreviewStep } from "./AutofillPreviewStep";
import { CropSideStep } from "./CropSideStep";
import { MetadataStep } from "./MetadataStep";
import { SectionsStep } from "./SectionsStep";
import { ReviewStep } from "./ReviewStep";
import { CollectorButton, CollectorLoading, CollectorPageHeader } from "../ui";

const STEPS: WizardStep[] = ["front", "metadata", "back", "sections", "review"];

function cardToDraft(card: Record<string, unknown>, sections: string[]): CollectorCardDraft {
  const extra = (card.identification_extra ?? {}) as Record<string, unknown>;
  const identifiers = Array.isArray(extra.identifiers)
    ? extra.identifiers.filter((x): x is string => typeof x === "string")
    : [];
  return {
    publicId: String(card.public_id),
    cardName: String(card.card_name ?? ""),
    cardGame: String(card.card_game ?? "Pokémon"),
    setName: String(card.set_name ?? ""),
    setCode: String(card.set_code ?? ""),
    cardNumber: String(card.card_number ?? ""),
    releaseYear: card.release_year != null ? String(card.release_year) : "",
    language: String(card.language ?? ""),
    variant: String(card.variant ?? ""),
    rarity: String(card.rarity ?? ""),
    finishType: String(card.finish_type ?? ""),
    edition: String(card.edition ?? ""),
    condition: String(card.condition ?? ""),
    cardState: String(card.card_state ?? "raw"),
    gradingCompany: String(card.grading_company ?? ""),
    officialGrade: String(card.official_grade ?? ""),
    certificationNumber: String(card.certification_number ?? ""),
    publicDescription: String(card.public_description ?? ""),
    tradeStatus: String(card.trade_status ?? "not_available"),
    tradeValueMinorUnits:
      card.trade_value_minor_units != null ? String(card.trade_value_minor_units) : "",
    tradeValueCurrency: String(card.trade_value_currency ?? "USD"),
    tradeNotes: String(card.trade_notes ?? ""),
    ownerPrivateNotes: String(card.owner_private_notes ?? ""),
    wantedNotes: String(card.wanted_notes ?? ""),
    wantedPriority: String(card.wanted_priority ?? ""),
    wantedPreferredGrader: String(card.wanted_preferred_grader ?? ""),
    wantedMinGrade: String(card.wanted_min_grade ?? ""),
    wantedMaxGrade: String(card.wanted_max_grade ?? ""),
    wantedMinCondition: String(card.wanted_min_condition ?? ""),
    visibility: String(card.visibility ?? "public"),
    ownershipType: String(card.ownership_type ?? "owned"),
    identificationConfidence:
      typeof card.identification_confidence === "number" ? card.identification_confidence : null,
    identificationExtra:
      card.identification_extra && typeof card.identification_extra === "object"
        ? (card.identification_extra as Record<string, unknown>)
        : {},
    identifiers,
    sections,
    frontConfirmed: false,
    backConfirmed: false,
  };
}

const AUTOFILL_KEYS = [
  "cardName",
  "cardGame",
  "setName",
  "setCode",
  "cardNumber",
  "releaseYear",
  "language",
  "variant",
  "rarity",
  "finishType",
  "edition",
  "identifiers",
  "identificationConfidence",
  "identificationExtra",
] as const satisfies readonly (keyof CollectorCardDraft)[];

function valuesDiffer(current: unknown, baseline: unknown): boolean {
  if (Array.isArray(current) || Array.isArray(baseline)) {
    return JSON.stringify(current) !== JSON.stringify(baseline);
  }
  if (
    current &&
    baseline &&
    typeof current === "object" &&
    typeof baseline === "object"
  ) {
    return JSON.stringify(current) !== JSON.stringify(baseline);
  }
  return current !== baseline;
}

function mergeIdentifiedDraft(
  current: CollectorCardDraft,
  baseline: CollectorCardDraft,
  identified: CollectorCardDraft
): CollectorCardDraft {
  const merged = { ...current };
  for (const key of AUTOFILL_KEYS) {
    merged[key] = valuesDiffer(current[key], baseline[key]) ? current[key] : identified[key];
  }
  return merged;
}

function draftToPatch(draft: CollectorCardDraft): Record<string, unknown> {
  return {
    card_name: draft.cardName || "Untitled card",
    card_game: draft.cardGame,
    set_name: draft.setName || null,
    set_code: draft.setCode || null,
    card_number: draft.cardNumber || null,
    release_year: draft.releaseYear ? Number(draft.releaseYear) : null,
    language: draft.language || null,
    variant: draft.variant || null,
    rarity: draft.rarity || null,
    finish_type: draft.finishType || null,
    edition: draft.edition || null,
    condition: draft.condition || null,
    card_state: draft.cardState,
    grading_company: draft.gradingCompany || null,
    official_grade: draft.officialGrade || null,
    certification_number: draft.certificationNumber || null,
    public_description: draft.publicDescription || null,
    trade_status: draft.tradeStatus,
    trade_value_minor_units: draft.tradeValueMinorUnits
      ? Number(draft.tradeValueMinorUnits)
      : null,
    trade_value_currency: draft.tradeValueCurrency || null,
    trade_notes: draft.tradeNotes || null,
    owner_private_notes: draft.ownerPrivateNotes || null,
    wanted_notes: draft.wantedNotes || null,
    wanted_priority: draft.wantedPriority || null,
    wanted_preferred_grader: draft.wantedPreferredGrader || null,
    wanted_min_grade: draft.wantedMinGrade || null,
    wanted_max_grade: draft.wantedMaxGrade || null,
    wanted_min_condition: draft.wantedMinCondition || null,
    visibility: draft.visibility,
    ownership_type: draft.ownershipType,
    identification_extra: {
      ...draft.identificationExtra,
      identifiers: draft.identifiers.filter(Boolean),
    },
    sections: draft.sections,
  };
}

export function CardWizard() {
  const { publicCardId: routeCardId } = useParams<{ publicCardId?: string }>();
  const navigate = useNavigate();
  const isNew = !routeCardId;
  const [step, setStep] = useState<WizardStep>("front");
  const [draft, setDraft] = useState<CollectorCardDraft | null>(
    isNew ? null : ({ ...EMPTY_DRAFT, publicId: routeCardId! } as CollectorCardDraft)
  );
  const [imagePaths, setImagePaths] = useState<{
    frontDisplayUrl?: string | null;
    backDisplayUrl?: string | null;
  }>({});
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const identifyBaselineRef = useRef<CollectorCardDraft | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const stepIndex = STEPS.indexOf(step);

  const patchDraft = useCallback((patch: Partial<CollectorCardDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  useEffect(() => {
    if (isNew) {
      setLoading(true);
      createCollectorCard({ ownership_type: "owned", status: "draft" })
        .then(({ card }) => {
          navigate(`/collector/cards/${card.public_id}/edit`, { replace: true });
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to start wizard"))
        .finally(() => setLoading(false));
      return;
    }
    if (!routeCardId) return;
    setLoading(true);
    fetchCollectorCard(routeCardId)
      .then((data) => {
        const images = (data.images ?? []) as Array<{
          image_role: string;
          confirmed_by_user?: boolean;
          displayUrl?: string | null;
        }>;
        const front = images.find((i) => i.image_role === "front");
        const back = images.find((i) => i.image_role === "back");
        setDraft({
          ...cardToDraft(data.card as Record<string, unknown>, data.sections ?? []),
          frontConfirmed: Boolean(front?.confirmed_by_user),
          backConfirmed: Boolean(back?.confirmed_by_user),
        });
        setImagePaths({
          frontDisplayUrl: front?.displayUrl ?? null,
          backDisplayUrl: back?.displayUrl ?? null,
        });
        if (front?.confirmed_by_user) setStep("metadata");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load card"))
      .finally(() => setLoading(false));
  }, [isNew, routeCardId, navigate]);

  const runIdentify = async (publicId: string, role: "front" | "back") => {
    setIdentifying(true);
    identifyBaselineRef.current = draftRef.current;
    try {
      await identifyCollectorCard(publicId, role);
      const refreshed = await fetchCollectorCard(publicId);
      const baseline = identifyBaselineRef.current;
      setDraft((prev) => {
        if (!prev) return prev;
        const identified = cardToDraft(
          refreshed.card as Record<string, unknown>,
          refreshed.sections ?? prev.sections
        );
        const merged = baseline
          ? mergeIdentifiedDraft(prev, baseline, identified)
          : identified;
        return {
          ...merged,
          publicId: prev.publicId,
          frontConfirmed: prev.frontConfirmed,
          backConfirmed: prev.backConfirmed,
          sections: prev.sections,
        };
      });
    } catch {
      /* identification is best-effort */
    } finally {
      identifyBaselineRef.current = null;
      setIdentifying(false);
    }
  };

  const onFrontConfirmed = async () => {
    if (!draft) return;
    patchDraft({ frontConfirmed: true });
    setStep("metadata");
    const refreshed = await fetchCollectorCard(draft.publicId);
    const front = (refreshed.images ?? []).find(
      (i: { image_role: string }) => i.image_role === "front"
    ) as { displayUrl?: string | null } | undefined;
    setImagePaths((p) => ({ ...p, frontDisplayUrl: front?.displayUrl ?? null }));
    await runIdentify(draft.publicId, "front");
  };

  const onBackConfirmed = async () => {
    if (!draft) return;
    patchDraft({ backConfirmed: true });
    const refreshed = await fetchCollectorCard(draft.publicId);
    const back = (refreshed.images ?? []).find(
      (i: { image_role: string }) => i.image_role === "back"
    ) as { displayUrl?: string | null } | undefined;
    setImagePaths((p) => ({ ...p, backDisplayUrl: back?.displayUrl ?? null }));
    if ((draft.identificationConfidence ?? 0) < 0.75) {
      await runIdentify(draft.publicId, "back");
    }
    setStep("sections");
  };

  const saveDraft = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await patchCollectorCard(draft.publicId, draftToPatch(draft));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const goNext = async () => {
    if (step === "metadata") {
      await saveDraft();
      setStep("back");
      return;
    }
    if (step === "sections") {
      await saveDraft();
      setStep("review");
      return;
    }
  };

  const goBack = () => {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1]!);
  };

  const publish = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await saveDraft();
      await publishCollectorCard(draft.publicId);
      navigate("/collector/cards");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  const lowConfidenceFields = useMemo(() => {
    if ((draft?.identificationConfidence ?? 1) >= 0.5) return new Set<string>();
    return new Set(["cardName", "setName", "cardNumber", "rarity"]);
  }, [draft?.identificationConfidence]);

  if (loading) {
    return <CollectorLoading label="Loading card wizard…" />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        to="/collector/cards"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to cards
      </Link>

      <CollectorPageHeader
        title={isNew ? "Add a card" : "Edit card"}
        description="Drop your photos — we crop them for your showcase. Review autofill, then publish."
      />

      <div className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              s === step
                ? "bg-accent text-white"
                : i < stepIndex
                  ? "bg-accent/15 text-accent"
                  : "bg-surface-overlay text-text-muted"
            }`}
          >
            {s === "front"
              ? "Front"
              : s === "metadata"
                ? "Details"
                : s === "back"
                  ? "Back"
                  : s === "sections"
                    ? "Sections"
                    : "Review"}
          </span>
        ))}
      </div>

      {step === "front" && draft && (
        <CropSideStep
          publicCardId={draft.publicId}
          role="front"
          title="Front photo"
          description="Upload the front — GemCheck crops it for your showcase (uses your daily crop allowance)."
          required
          confirmed={draft.frontConfirmed}
          existingDisplayUrl={imagePaths.frontDisplayUrl}
          onConfirmed={() => void onFrontConfirmed()}
          onUnconfirm={() => patchDraft({ frontConfirmed: false })}
        />
      )}

      {step === "metadata" && draft && (
        <>
          <AutofillPreviewStep
            draft={draft}
            imagePaths={imagePaths}
            identifying={identifying}
          />
          <MetadataStep draft={draft} onChange={patchDraft} lowConfidenceFields={lowConfidenceFields} />
        </>
      )}

      {step === "back" && draft && (
        <CropSideStep
          publicCardId={draft.publicId}
          role="back"
          title="Back photo"
          description="Upload the back — required before publishing owned cards."
          required
          confirmed={draft.backConfirmed}
          existingDisplayUrl={imagePaths.backDisplayUrl}
          onConfirmed={() => void onBackConfirmed()}
          onUnconfirm={() => patchDraft({ backConfirmed: false })}
        />
      )}

      {step === "sections" && draft && (
        <SectionsStep sections={draft.sections} onChange={(sections) => patchDraft({ sections })} />
      )}

      {step === "review" && draft && (
        <ReviewStep draft={draft} imagePaths={imagePaths} />
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
        {stepIndex > 0 && step !== "front" && (
          <CollectorButton variant="secondary" onClick={goBack} disabled={busy}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </CollectorButton>
        )}
        {(step === "metadata" || step === "sections") && (
          <CollectorButton loading={busy} onClick={() => void goNext()}>
            Continue
            <ArrowRight className="h-4 w-4" />
          </CollectorButton>
        )}
        {step === "review" && (
          <CollectorButton loading={busy} onClick={() => void publish()}>
            <CheckCircle2 className="h-4 w-4" />
            Publish card
          </CollectorButton>
        )}
      </div>
    </div>
  );
}
