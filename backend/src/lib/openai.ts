import { getServiceClient } from "./supabase.js";
import { computeCostUsd } from "./pricing.js";

// Single entry point for OpenAI chat/vision calls. Every call's token usage is
// converted to cost and written to ai_usage, so all AI spend is tracked in one
// place. A safe no-op (returns null) when OPENAI_API_KEY is not set.
const KEY = process.env.OPENAI_API_KEY || "";

export function isOpenAiConfigured(): boolean {
  return Boolean(KEY);
}

export interface ChatImage {
  dataUrl: string;
  detail?: "low" | "high" | "auto";
}

export interface ChatOptions {
  model: string;
  system: string;
  user: string;
  images?: ChatImage[];
  jsonObject?: boolean;
  maxTokens?: number;
  temperature?: number;
  // Cost attribution:
  feature: string;
  userId?: string | null;
  timeoutMs?: number;
}

export interface ChatResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

type TextPart = { type: "text"; text: string };
type ImagePart = {
  type: "image_url";
  image_url: { url: string; detail: "low" | "high" | "auto" };
};

export async function chatComplete(opts: ChatOptions): Promise<ChatResult | null> {
  if (!KEY) return null;

  const userContent: (TextPart | ImagePart)[] = [{ type: "text", text: opts.user }];
  for (const img of opts.images ?? []) {
    userContent.push({
      type: "image_url",
      image_url: { url: img.dataUrl, detail: img.detail ?? "high" },
    });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: opts.temperature ?? 0,
        max_tokens: opts.maxTokens ?? 1200,
        ...(opts.jsonObject ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 45000),
    });
    if (!res.ok) {
      console.error(
        "OpenAI call failed:",
        res.status,
        (await res.text().catch(() => "")).slice(0, 300)
      );
      return null;
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const promptTokens = json.usage?.prompt_tokens ?? 0;
    const completionTokens = json.usage?.completion_tokens ?? 0;
    const costUsd = computeCostUsd(opts.model, promptTokens, completionTokens);

    // Record spend (fire-and-forget; must never fail the request).
    getServiceClient()
      .from("ai_usage")
      .insert({
        user_id: opts.userId ?? null,
        feature: opts.feature,
        model: opts.model,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd: Number(costUsd.toFixed(6)),
      })
      .then(({ error }) => {
        if (error) console.error("ai_usage log failed:", error);
      });

    if (!content) return null;
    return { content, promptTokens, completionTokens, costUsd };
  } catch (err) {
    console.error("OpenAI call error:", err);
    return null;
  }
}
