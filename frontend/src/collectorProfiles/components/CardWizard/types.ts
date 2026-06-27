export type WizardStep =
  | "front"
  | "metadata"
  | "back"
  | "sections"
  | "review";

export interface CollectorCardDraft {
  publicId: string;
  cardName: string;
  cardGame: string;
  setName: string;
  setCode: string;
  cardNumber: string;
  releaseYear: string;
  language: string;
  variant: string;
  rarity: string;
  finishType: string;
  edition: string;
  condition: string;
  cardState: string;
  gradingCompany: string;
  officialGrade: string;
  certificationNumber: string;
  publicDescription: string;
  tradeStatus: string;
  tradeValueMinorUnits: string;
  tradeValueCurrency: string;
  tradeNotes: string;
  ownerPrivateNotes: string;
  wantedNotes: string;
  wantedPriority: string;
  wantedPreferredGrader: string;
  wantedMinGrade: string;
  wantedMaxGrade: string;
  wantedMinCondition: string;
  visibility: string;
  ownershipType: string;
  identificationConfidence: number | null;
  identificationExtra: Record<string, unknown>;
  identifiers: string[];
  sections: string[];
  frontConfirmed: boolean;
  backConfirmed: boolean;
}

export const EMPTY_DRAFT: Omit<CollectorCardDraft, "publicId"> = {
  cardName: "",
  cardGame: "Pokémon",
  setName: "",
  setCode: "",
  cardNumber: "",
  releaseYear: "",
  language: "",
  variant: "",
  rarity: "",
  finishType: "",
  edition: "",
  condition: "",
  cardState: "raw",
  gradingCompany: "",
  officialGrade: "",
  certificationNumber: "",
  publicDescription: "",
  tradeStatus: "not_available",
  tradeValueMinorUnits: "",
  tradeValueCurrency: "USD",
  tradeNotes: "",
  ownerPrivateNotes: "",
  wantedNotes: "",
  wantedPriority: "",
  wantedPreferredGrader: "",
  wantedMinGrade: "",
  wantedMaxGrade: "",
  wantedMinCondition: "",
  visibility: "public",
  ownershipType: "owned",
  identificationConfidence: null,
  identificationExtra: {},
  identifiers: [],
  sections: ["showcase"],
  frontConfirmed: false,
  backConfirmed: false,
};
