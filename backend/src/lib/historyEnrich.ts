import { getServiceClient } from "./supabase.js";
import { signedGetUrl } from "./r2.js";
import type { CentringPayload } from "./centringPayload.js";
import { buildCentringPayload, type MeasuredCentringFront } from "./centringPayload.js";
import { syncCatalogCentring } from "./adminCatalog.js";
import type { UsageEvent } from "./usageEvents.js";

export interface EnrichedUsageEvent extends UsageEvent {
  thumbnailUrl?: string | null;
}

export async function enrichHistoryEvents(events: UsageEvent[]): Promise<EnrichedUsageEvent[]> {
  const hashes = events
    .filter((e) => e.kind === "crop")
    .map((e) => (typeof e.detail?.content_hash === "string" ? e.detail.content_hash : null))
    .filter((h): h is string => Boolean(h));

  if (!hashes.length) return events;

  const { data } = await getServiceClient()
    .from("catalog_items")
    .select("content_hash, r2_key, name, card_set, number")
    .in("content_hash", hashes);

  const byHash = new Map(
    (data ?? []).map((row) => [String(row.content_hash), row as Record<string, unknown>])
  );

  return Promise.all(
    events.map(async (e) => {
      if (e.kind !== "crop") return e;
      const hash =
        typeof e.detail?.content_hash === "string" ? e.detail.content_hash : null;
      if (!hash) return e;
      const cat = byHash.get(hash);
      if (!cat) return e;

      const detail = { ...(e.detail ?? {}) };
      if (typeof cat.name === "string" && cat.name.trim()) detail.card_name = cat.name.trim();
      if (typeof cat.card_set === "string") detail.card_set = cat.card_set;
      if (typeof cat.number === "string") detail.number = cat.number;

      const r2Key = typeof cat.r2_key === "string" ? cat.r2_key : null;
      return {
        ...e,
        detail,
        thumbnailUrl: r2Key ? await signedGetUrl(r2Key, 900).catch(() => null) : null,
      };
    })
  );
}

export async function updateHistoryEventCentring(
  userId: string,
  eventId: number,
  front: MeasuredCentringFront
): Promise<CentringPayload | null> {
  const centring = buildCentringPayload(front);
  const sb = getServiceClient();

  const { data: row, error: fetchErr } = await sb
    .from("usage_events")
    .select("id, kind, detail")
    .eq("id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row || row.kind !== "crop") return null;

  const detail = (row.detail && typeof row.detail === "object" ? row.detail : {}) as Record<
    string,
    unknown
  >;
  const merged = { ...detail, centring };

  const { data, error } = await sb
    .from("usage_events")
    .update({ detail: merged })
    .eq("id", eventId)
    .eq("user_id", userId)
    .select("detail")
    .maybeSingle();
  if (error) throw error;

  const hash = typeof detail.content_hash === "string" ? detail.content_hash : "";
  if (hash && centring) {
    syncCatalogCentring(hash, centring).catch((err) =>
      console.error("syncCatalogCentring failed:", err)
    );
  }

  const out = data?.detail as Record<string, unknown> | undefined;
  return (out?.centring as CentringPayload) ?? centring;
}
