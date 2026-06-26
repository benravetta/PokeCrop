import type { HumanPregradeConfig } from "../api";

export const MAX_IMAGE_BYTES = 52_428_800;

export type OrderFormState = {
  cardGame: string;
  cardName: string;
  setName: string;
  cardNumber: string;
  mainConcern: string;
  customerNotes: string;
  trainingConsent: boolean;
  termsAccepted: boolean;
  selectedGraderIds: string[];
};

export type OrderFormErrors = Partial<
  Record<keyof OrderFormState | "frontFile" | "backFile" | "_form", string>
>;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function validateImageFile(file: File | null, label: string): string | null {
  if (!file) return `${label} is required.`;
  if (!file.type.startsWith("image/") && !IMAGE_TYPES.has(file.type)) {
    return `${label} must be a JPEG, PNG, or WebP image.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${label} must be under 50 MB.`;
  }
  if (file.size <= 0) return `${label} is empty.`;
  return null;
}

export function validateOrderStep(
  step: number,
  form: OrderFormState,
  frontFile: File | null,
  backFile: File | null
): OrderFormErrors {
  const errors: OrderFormErrors = {};

  if (step === 0) {
    if (!form.cardGame.trim()) errors.cardGame = "Select a card game.";
    if (!form.cardName.trim()) errors.cardName = "Card name is required.";
    if (!form.setName.trim()) errors.setName = "Set name is required.";
    if (!form.cardNumber.trim()) errors.cardNumber = "Card number is required.";
  }

  if (step === 1) {
    if (!form.mainConcern.trim()) errors.mainConcern = "Tell us what you want the expert to focus on.";
    if (form.selectedGraderIds.length === 0) errors.selectedGraderIds = "Select at least one grader.";
  }

  if (step === 2) {
    const frontErr = validateImageFile(frontFile, "Front image");
    const backErr = validateImageFile(backFile, "Back image");
    if (frontErr) errors.frontFile = frontErr;
    if (backErr) errors.backFile = backErr;
  }

  if (step === 3) {
    if (!form.termsAccepted) {
      errors.termsAccepted = "Accept the terms to continue.";
    }
  }

  return errors;
}

export function hasErrors(errors: OrderFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function initialFormFromParams(
  params: URLSearchParams,
  defaultGraderId?: string
): OrderFormState {
  return {
    cardGame: "Pokemon",
    cardName: params.get("cardName")?.trim() ?? "",
    setName: params.get("setName")?.trim() ?? "",
    cardNumber: params.get("cardNumber")?.trim() ?? "",
    mainConcern: "",
    customerNotes: "",
    trainingConsent: false,
    termsAccepted: false,
    selectedGraderIds: defaultGraderId ? [defaultGraderId] : [],
  };
}

export function graderLabel(config: HumanPregradeConfig, id: string): string {
  return config.graders.find((g) => g.id === id)?.name ?? id;
}
