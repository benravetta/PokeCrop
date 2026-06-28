import { Sparkles } from "lucide-react";
import { CardSpecSheet } from "../CardSpecSheet";
import { CollectorSection } from "../ui";
import { draftToSpec } from "./draftToSpec";
import type { CollectorCardDraft } from "./types";

export function AutofillPreviewStep({
  draft,
  imagePaths,
  identifying,
}: {
  draft: CollectorCardDraft;
  imagePaths?: { frontDisplayUrl?: string | null; backDisplayUrl?: string | null };
  identifying?: boolean;
}) {
  const hasAutofill =
    draft.cardName ||
    draft.setName ||
    draft.cardNumber ||
    draft.rarity ||
    (draft.identificationConfidence ?? 0) > 0;

  return (
    <CollectorSection
      title="How visitors will see it"
      description="We cropped your photo and filled in what we could read from the card."
    >
      <div className="mb-5 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div className="space-y-1 text-sm text-text-secondary">
            {identifying ? (
              <p>Reading card details from your photo…</p>
            ) : hasAutofill ? (
              <>
                <p className="text-text-primary">
                  Your card is cropped and ready for your showcase.
                </p>
                <p>
                  Review the details below — adjust anything that doesn&apos;t look right before you
                  publish.
                </p>
              </>
            ) : (
              <>
                <p className="text-text-primary">Your card photo is cropped and ready.</p>
                <p>Fill in the details below so visitors know what they&apos;re looking at.</p>
              </>
            )}
          </div>
        </div>
      </div>

      <CardSpecSheet spec={draftToSpec(draft, imagePaths)} />
    </CollectorSection>
  );
}
