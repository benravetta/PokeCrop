import { assertMaxLength, MAX_TEXT_FIELD } from "./limits.js";
import { HumanPregradeError, type HumanPregradeOrderRow } from "./types.js";
import { getOrderGraderIds } from "../infrastructure/orderRepo.js";
import { orderHasMandatoryImages } from "../adapters/storageAdapter.js";

export function trimOptionalText(
  value: unknown,
  maxBytes: number,
  label: string
): string | null {
  const s = assertMaxLength(value, maxBytes, label);
  const trimmed = s?.trim();
  return trimmed || null;
}

export function requireText(value: unknown, maxBytes: number, label: string): string {
  const s = assertMaxLength(value, maxBytes, label);
  const trimmed = s?.trim();
  if (!trimmed) {
    throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_INPUT", `${label} is required`, 400);
  }
  return trimmed;
}

export function parseCustomerOrderDraft(body: Record<string, unknown>) {
  return {
    cardGame: requireText(body.cardGame ?? "Pokemon", 64, "Card game"),
    cardName: requireText(body.cardName, 200, "Card name"),
    setName: requireText(body.setName, 200, "Set name"),
    cardNumber: requireText(body.cardNumber, 64, "Card number"),
    mainConcern: requireText(body.mainConcern, MAX_TEXT_FIELD, "Main concern"),
    customerNotes: trimOptionalText(body.customerNotes, MAX_TEXT_FIELD, "Notes"),
    trainingConsent: Boolean(body.trainingConsent),
  };
}

export async function assertOrderReadyForCheckout(
  order: HumanPregradeOrderRow,
  mandatoryImageTypes: string[]
): Promise<void> {
  if (!order.card_name?.trim()) {
    throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_INPUT", "Card name is required", 400);
  }
  if (!order.set_name?.trim()) {
    throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_INPUT", "Set name is required", 400);
  }
  if (!order.card_number?.trim()) {
    throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_INPUT", "Card number is required", 400);
  }
  if (!order.main_concern?.trim()) {
    throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_INPUT", "Main concern is required", 400);
  }

  const graderIds = await getOrderGraderIds(order.id);
  if (!graderIds.length) {
    throw new HumanPregradeError("HUMAN_PREGRADE_INVALID_INPUT", "Select at least one grader", 400);
  }

  const hasImages = await orderHasMandatoryImages(order.id, mandatoryImageTypes);
  if (!hasImages) {
    throw new HumanPregradeError("HUMAN_PREGRADE_IMAGES_REQUIRED", "Front and back images are required", 400);
  }
}
