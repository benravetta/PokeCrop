// Per-model OpenAI pricing in USD per 1,000,000 tokens.
//
// OpenAI provides no pricing API, so these rates are maintained by hand. Token
// counts come back exactly from each response's `usage`, so cost is precise as
// long as these rates are current. Update if OpenAI changes pricing.
// Last reviewed: 2026-06. Override at runtime with OPENAI_PRICE_OVERRIDES
// (JSON: { "model": { "input": <usd/1M>, "output": <usd/1M> } }).
interface Rate {
  input: number;
  output: number;
}

const BASE_PRICES: Record<string, Rate> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1": { input: 2.0, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
};

function loadOverrides(): Record<string, Rate> {
  const raw = process.env.OPENAI_PRICE_OVERRIDES;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, Rate>;
  } catch {
    console.error("Invalid OPENAI_PRICE_OVERRIDES JSON; ignoring.");
    return {};
  }
}

const PRICES: Record<string, Rate> = { ...BASE_PRICES, ...loadOverrides() };

// Resolve a rate, tolerating dated/suffixed model ids (e.g. "gpt-4o-2024-08-06").
function rateFor(model: string): Rate | null {
  if (PRICES[model]) return PRICES[model];
  const match = Object.keys(PRICES)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PRICES[match] : null;
}

// Cost in USD for a call. Returns 0 (and warns) for unknown models so we never
// crash — but an unpriced model means under-reported spend, so keep PRICES current.
export function computeCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rate = rateFor(model);
  if (!rate) {
    console.warn(`No price for model "${model}"; cost recorded as 0.`);
    return 0;
  }
  return (
    (promptTokens / 1_000_000) * rate.input +
    (completionTokens / 1_000_000) * rate.output
  );
}
