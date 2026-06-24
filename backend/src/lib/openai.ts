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

export interface ResponsesWebSearchOptions {
  model: string;
  instructions: string;
  input: string;
  feature: string;
  userId?: string | null;
  timeoutMs?: number;
  allowedDomains?: string[];
}

export interface ResponsesWebSearchResult {
  text: string;
  citations: { url: string; title?: string }[];
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

type ResponsesPayload = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: Array<{ type?: string; url?: string; title?: string }>;
    }>;
  }>;
  output_text?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/** OpenAI-hosted web search (Responses API) — no third-party market API keys. */
export async function responsesWebSearch(
  opts: ResponsesWebSearchOptions
): Promise<ResponsesWebSearchResult | null> {
  if (!KEY) return null;

  const domains = opts.allowedDomains ?? [
    "ebay.co.uk",
    "ebay.com",
    "pricecharting.com",
    "cardmarket.com",
  ];

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        instructions: opts.instructions,
        input: opts.input,
        tools: [
          {
            type: "web_search",
            search_context_size: "medium",
            user_location: { type: "approximate", country: "GB" },
            filters: { allowed_domains: domains },
          },
        ],
        tool_choice: "required",
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 55_000),
    });

    if (!res.ok) {
      console.error(
        "OpenAI responses/web_search failed:",
        res.status,
        (await res.text().catch(() => "")).slice(0, 400)
      );
      return null;
    }

    const json = (await res.json()) as ResponsesPayload;
    const citations: { url: string; title?: string }[] = [];
    let text = json.output_text ?? "";

    for (const item of json.output ?? []) {
      if (item.type !== "message") continue;
      for (const block of item.content ?? []) {
        if (block.text) text = block.text;
        for (const ann of block.annotations ?? []) {
          if (ann.type === "url_citation" && ann.url) {
            citations.push({ url: ann.url, title: ann.title });
          }
        }
      }
    }

    if (!text.trim()) return null;

    const promptTokens = json.usage?.input_tokens ?? 0;
    const completionTokens = json.usage?.output_tokens ?? 0;
    const costUsd = computeCostUsd(opts.model, promptTokens, completionTokens);

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

    return { text, citations, promptTokens, completionTokens, costUsd };
  } catch (err) {
    console.error("OpenAI responses/web_search error:", err);
    return null;
  }
}
