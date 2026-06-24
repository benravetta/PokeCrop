import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, ImageOff, Layers } from "lucide-react";
import { adminCatalogItems, type CatalogItem } from "../lib/api";
import { centringLabel, fmtCropDate } from "../lib/centringDisplay";

const PAGE_SIZE = 24;

function prettyTcg(tcg: string): string {
  if (tcg === "one-piece") return "One Piece";
  if (tcg === "pokemon") return "Pokémon";
  if (tcg === "unidentified") return "Unidentified";
  return tcg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CatalogPage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminCatalogItems({
        q: query || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalog.");
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full">
        <div className="flex items-center gap-3 mb-1">
          <Layers className="w-6 h-6 text-accent" />
          <h1 className="text-xl font-semibold text-text-primary">Admin catalog</h1>
        </div>
        <p className="text-sm text-text-secondary">
          Every archived crop with detect confidence, card ID, centring scores and dimensions — searchable.
        </p>

        <div className="mt-5 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search card name, set, number or TCG…"
            className="w-full rounded-xl border border-border-subtle bg-surface-raised pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        {error && (
          <p className="mt-4 text-sm text-error">{error}</p>
        )}

        {loading ? (
          <div className="mt-12 flex justify-center">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="mt-12 text-center text-sm text-text-muted">
            {query ? "No crops match your search." : "No archived crops yet."}
          </p>
        ) : (
          <>
            <p className="mt-4 text-xs text-text-muted">{total.toLocaleString()} crop{total === 1 ? "" : "s"}</p>
            <ul className="mt-3 divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-raised overflow-hidden">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 p-3 sm:p-4 hover:bg-surface-overlay/40 transition-colors"
                >
                  <div className="w-14 h-[4.5rem] shrink-0 rounded-lg border border-border-subtle bg-surface-overlay overflow-hidden flex items-center justify-center">
                    {item.url ? (
                      <img
                        src={item.url}
                        alt=""
                        className="w-full h-full object-contain checkerboard"
                      />
                    ) : (
                      <ImageOff className="w-5 h-5 text-text-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 grid sm:grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">
                        {item.name || `${prettyTcg(item.tcg)} · ${item.cardSet}`}
                      </div>
                      <div className="text-xs text-text-muted truncate">
                        {[prettyTcg(item.tcg), item.cardSet, item.number ? `#${item.number}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        {fmtCropDate(item.createdAt)}
                        {item.source ? ` · ${item.source}` : ""}
                      </div>
                    </div>
                    <div className="text-xs text-text-secondary sm:text-right space-y-0.5">
                      {item.pipelineConfidence != null && (
                        <div>
                          Detect{" "}
                          <span className="text-text-primary font-medium">
                            {Math.round(item.pipelineConfidence * 100)}%
                          </span>
                        </div>
                      )}
                      {item.idConfidence != null && (
                        <div>
                          ID{" "}
                          <span className="text-text-primary font-medium">
                            {Math.round(item.idConfidence * 100)}%
                          </span>
                        </div>
                      )}
                      <div>
                        Centring{" "}
                        <span className="text-text-primary font-medium">
                          {centringLabel(item.centring)}
                        </span>
                      </div>
                      {item.width && item.height && (
                        <div className="text-text-muted">
                          {item.width}×{item.height}px
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {pages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-border-subtle disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-text-muted">
                  Page {page} of {pages}
                </span>
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-border-subtle disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
