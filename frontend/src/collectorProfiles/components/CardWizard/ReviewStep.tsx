import type { CollectorCardDraft } from "./types";
import { CardSpecSheet, type CardSpecData } from "../CardSpecSheet";
import { CollectorSection } from "../ui";

export function draftToSpec(draft: CollectorCardDraft, images?: {
  frontDisplayUrl?: string | null;
  backDisplayUrl?: string | null;
}): CardSpecData {
  return {
    cardName: draft.cardName,
    cardGame: draft.cardGame,
    setName: draft.setName,
    setCode: draft.setCode,
    cardNumber: draft.cardNumber,
    releaseYear: draft.releaseYear ? Number(draft.releaseYear) : null,
    language: draft.language,
    variant: draft.variant,
    rarity: draft.rarity,
    finishType: draft.finishType,
    edition: draft.edition,
    condition: draft.condition,
    cardState: draft.cardState,
    gradingCompany: draft.gradingCompany,
    officialGrade: draft.officialGrade,
    certificationNumber: draft.certificationNumber,
    publicDescription: draft.publicDescription,
    tradeStatus: draft.tradeStatus,
    tradeValueMinorUnits: draft.tradeValueMinorUnits
      ? Number(draft.tradeValueMinorUnits)
      : null,
    tradeValueCurrency: draft.tradeValueCurrency,
    identifiers: draft.identifiers.filter(Boolean),
    identificationConfidence: draft.identificationConfidence,
    frontDisplayUrl: images?.frontDisplayUrl ?? null,
    backDisplayUrl: images?.backDisplayUrl ?? null,
  };
}

export function ReviewStep({
  draft,
  imagePaths,
}: {
  draft: CollectorCardDraft;
  imagePaths?: { frontDisplayUrl?: string | null; backDisplayUrl?: string | null };
}) {
  return (
    <CollectorSection title="Review" description="Check everything before publishing.">
      <CardSpecSheet spec={draftToSpec(draft, imagePaths)} />
      <p className="mt-4 text-xs text-text-muted">
        Sections: {draft.sections.join(", ") || "none selected"}
      </p>
    </CollectorSection>
  );
}
