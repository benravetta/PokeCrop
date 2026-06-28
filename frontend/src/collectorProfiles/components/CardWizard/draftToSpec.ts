import type { CardSpecData } from "../CardSpecSheet";
import type { CollectorCardDraft } from "./types";

export function draftToSpec(
  draft: CollectorCardDraft,
  images?: {
    frontDisplayUrl?: string | null;
    backDisplayUrl?: string | null;
  }
): CardSpecData {
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
