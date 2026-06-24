import { getServiceClient } from "./supabase.js";
import { signedGetUrl } from "./r2.js";
import type { CentringPayload } from "./centringPayload.js";

export interface AdminCatalogListOpts {
  q?: string;
  tcg?: string;
  set?: string;
  number?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminCatalogListItem {
  id: number;
  tcg: string;
  cardSet: string;
  number: string;
  name: string | null;
  idConfidence: number | null;
  pipelineConfidence: number | null;
  width: number | null;
  height: number | null;
  centring: CentringPayload | null;
  source: string | null;
  createdAt: string;
  url: string | null;
}

export async function listAdminCatalogItems(opts: AdminCatalogListOpts): Promise<{
  items: AdminCatalogListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, opts.pageSize ?? 24));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = getServiceClient()
    .from("catalog_items")
    .select(
      "id, r2_key, tcg, card_set, number, name, confidence, pipeline_confidence, width, height, centring, source, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (opts.tcg) query = query.eq("tcg", opts.tcg);
  if (opts.set) query = query.eq("card_set", opts.set);
  if (opts.number) query = query.eq("number", opts.number);

  const q = opts.q?.trim();
  if (q) {
    const safe = q.replace(/[%,]/g, " ");
    query = query.or(
      `name.ilike.%${safe}%,card_set.ilike.%${safe}%,number.ilike.%${safe}%,tcg.ilike.%${safe}%`
    );
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  const items: AdminCatalogListItem[] = await Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id as number,
      tcg: String(row.tcg ?? ""),
      cardSet: String(row.card_set ?? ""),
      number: String(row.number ?? ""),
      name: (row.name as string | null) ?? null,
      idConfidence: typeof row.confidence === "number" ? row.confidence : null,
      pipelineConfidence:
        typeof row.pipeline_confidence === "number" ? row.pipeline_confidence : null,
      width: typeof row.width === "number" ? row.width : null,
      height: typeof row.height === "number" ? row.height : null,
      centring: (row.centring as CentringPayload | null) ?? null,
      source: (row.source as string | null) ?? null,
      createdAt: String(row.created_at ?? ""),
      url: row.r2_key ? await signedGetUrl(String(row.r2_key), 900).catch(() => null) : null,
    }))
  );

  return { items, total: count ?? 0, page, pageSize };
}

/** Propagate a measured centring payload to the anonymous archive row, if present. */
export async function syncCatalogCentring(
  contentHash: string,
  centring: CentringPayload
): Promise<void> {
  await getServiceClient()
    .from("catalog_items")
    .update({ centring })
    .eq("content_hash", contentHash);
}
