import { Router } from "express";
import { requireActiveAuth } from "../middleware/auth.js";
import { lookupEbaySoldPrices } from "../lib/ebaySold/lookup.js";
import type { CardIdentity } from "../lib/ebaySold/types.js";
import { hasMinimumIdentity } from "../lib/ebaySold/cardIdentityNormaliser.js";

type EbaySoldRequestBody = Partial<CardIdentity> & {
  card_name?: string;
  set_name?: string;
  card_number?: string;
  condition_type?: CardIdentity["conditionType"];
};

export const valuationsRoutes = Router();

/** Internal GemCheck endpoint — eBay sold price lookup (no external pricing APIs). */
valuationsRoutes.post("/valuations/ebay-sold", requireActiveAuth, async (req, res) => {
  const body = req.body as EbaySoldRequestBody;
  const card: CardIdentity = {
    game: body.game ?? "Pokemon",
    cardName: String(body.cardName ?? body.card_name ?? "").trim(),
    setName: body.setName ?? body.set_name ?? undefined,
    cardNumber: body.cardNumber ?? body.card_number ?? undefined,
    year: body.year,
    edition: body.edition ?? undefined,
    variant: body.variant ?? null,
    finish: body.finish ?? null,
    language: body.language ?? "English",
    conditionType: body.conditionType ?? body.condition_type ?? "raw",
    grader: body.grader ?? null,
    grade: body.grade ?? null,
    currency: body.currency ?? "GBP",
  };

  if (!hasMinimumIdentity(card)) {
    res.status(400).json({
      status: "insufficient_card_identity",
      error_code: "INSUFFICIENT_CARD_IDENTITY",
      message: "cardName and either setName or cardNumber are required.",
    });
    return;
  }

  try {
    const result = await lookupEbaySoldPrices(card, { timeoutMs: 60_000 });
    const status = result.status === "success" ? 200 : result.status === "temporarily_unavailable" ? 503 : 200;
    res.status(status).json(result);
  } catch {
    res.status(503).json({
      status: "temporarily_unavailable",
      error_code: "SEARCH_TIMEOUT",
      message: "eBay sold-listing search failed. No valuation has been generated.",
    });
  }
});
