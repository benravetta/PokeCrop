import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  ChevronRight,
  Layers,
  FolderOpen,
  Hash,
  ImageOff,
} from "lucide-react";
import {
  adminCatalogFacets,
  adminCatalogItems,
  type CatalogFacet,
  type CatalogItem,
} from "../lib/api";

const PAGE_SIZE = 60;

function prettyTcg(tcg: string): string {
  if (tcg === "one-piece") return "One Piece";
  if (tcg === "pokemon") return "Pokémon";
  if (tcg === "unidentified") return "Unidentified";
  return tcg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CatalogPage() {
  const [tcg, setTcg] = useState<string | null>(null);
  const [set, setSet] = useState<string | null>(null);
  const [number, setNumber] = useState<string | null>(null);

  const [facets, setFacets] = useState<CatalogFacet[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Facets describe the next level down (TCGs → sets → numbers).
  const facetLevel: "tcg" | "set" | "number" | null = !tcg
    ? "tcg"
    : !set
      ? "set"
      : !number
        ? "number"
        : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [f, i] = await Promise.all([
        facetLevel
          ? adminCatalogFacets({ tcg: tcg ?? undefined, set: set ?? undefined })
          : Promise.resolve({ facets: [] }),
        adminCatalogItems({
          tcg: tcg ?? undefined,
          set: set ?? undefined,
          number: number ?? undefined,
          limit: PAGE_SIZE,
        }),
      ]);
      setFacets(f.facets);
      setItems(i.items);
      setTotal(i.total);
      setOffset(i.items.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalog.");
    } finally {
      setLoading(false);
    }
  }, [tcg, set, number, facetLevel]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    try {
      const res = await adminCatalogItems({
        tcg: tcg ?? undefined,
        set: set ?? undefined,
        number: number ?? undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setItems((prev) => [...prev, ...res.items]);
      setOffset((prev) => prev + res.items.length);
    } catch {
      /* ignore */
    }
  }, [tcg, set, number, offset]);

  const selectFacet = (label: string) => {
    if (facetLevel === "tcg") setTcg(label);
    else if (facetLevel === "set") setSet(label);
    else if (facetLevel === "number") setNumber(label);
  };

  const resetTo = (level: "root" | "tcg" | "set") => {
    if (level === "root") {
      setTcg(null);
      setSet(null);
      setNumber(null);
    } else if (level === "tcg") {
      setSet(null);
      setNumber(null);
    } else if (level === "set") {
      setNumber(null);
    }
  };

  const facetIcon =
    facetLevel === "tcg" ? Layers : facetLevel === "set" ? FolderOpen : Hash;
  const FacetIcon = facetIcon;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full">
      <div className="flex items-center gap-3 mb-1">
        <Layers className="w-6 h-6 text-accent" />
        <h1 className="text-2xl font-semibold text-text-primary">Catalog</h1>
      </div>
      <p className="text-text-secondary text-sm mb-6">
        Every archived crop, organised by TCG → set → card number.
      </p>

      {/* Breadcrumb */}
      <nav className="flex items-center flex-wrap gap-1 text-sm mb-6">
        <button
          onClick={() => resetTo("root")}
          className={`px-2 py-1 rounded-md hover:bg-surface-overlay transition-colors ${
            !tcg ? "text-text-primary font-medium" : "text-text-secondary"
          }`}
        >
          All TCGs
        </button>
        {tcg && (
          <>
              <ChevronRight className="w-4 h-4 text-text-muted" />
            <button
              onClick={() => resetTo("tcg")}
              className={`px-2 py-1 rounded-md hover:bg-surface-overlay transition-colors ${
                !set ? "text-text-primary font-medium" : "text-text-secondary"
              }`}
            >
              {prettyTcg(tcg)}
            </button>
          </>
        )}
        {set && (
          <>
            <ChevronRight className="w-4 h-4 text-text-muted" />
            <button
              onClick={() => resetTo("set")}
              className={`px-2 py-1 rounded-md hover:bg-surface-overlay transition-colors ${
                !number ? "text-text-primary font-medium" : "text-text-secondary"
              }`}
            >
              {set}
            </button>
          </>
        )}
        {number && (
          <>
            <ChevronRight className="w-4 h-4 text-text-muted" />
            <span className="px-2 py-1 text-text-primary font-medium">#{number}</span>
          </>
        )}
      </nav>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      ) : (
        <>
          {/* Facet tiles for the next level down */}
          {facetLevel && facets.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
              {facets.map((f) => (
                <button
                  key={f.label}
                  onClick={() => selectFacet(f.label)}
                  className="group flex items-center justify-between rounded-xl border border-border-subtle bg-surface-overlay px-4 py-3 text-left hover:border-accent/40 hover:bg-surface-overlay/70 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <FacetIcon className="w-4 h-4 text-text-muted shrink-0" />
                    <span className="truncate text-text-primary">
                      {facetLevel === "tcg"
                        ? prettyTcg(f.label)
                        : facetLevel === "number"
                          ? `#${f.label}`
                          : f.label}
                    </span>
                  </span>
                  <span className="text-xs text-text-secondary tabular-nums">{f.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Image grid */}
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
              <ImageOff className="w-8 h-8 mb-3 opacity-50" />
              <p className="text-sm">No crops here yet.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-text-secondary">
                  {total.toLocaleString()} crop{total === 1 ? "" : "s"}
                </h2>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {items.map((it) => (
                  <CatalogTile key={it.id} item={it} />
                ))}
              </div>
              {offset < total && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={loadMore}
                    className="rounded-lg border border-border-subtle bg-surface-overlay px-5 py-2 text-sm text-text-primary hover:border-accent/40 transition-colors"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
    </div>
  );
}

function CatalogTile({ item }: { item: CatalogItem }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="group relative aspect-[5/7] overflow-hidden rounded-lg border border-border-subtle bg-[conic-gradient(at_50%_50%,#1f2430_0deg,#171b24_90deg,#1f2430_180deg,#171b24_270deg)]">
      {item.url && !broken ? (
        <img
          src={item.url}
          alt={`${item.tcg} ${item.card_set} #${item.number}`}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-text-muted">
          <ImageOff className="w-5 h-5" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.name && (
          <div className="truncate text-[11px] font-medium leading-tight text-white">
            {item.name}
          </div>
        )}
        <div className="text-[10px] leading-tight text-white/80">
          {item.width && item.height ? `${item.width}×${item.height}` : ""}
          {item.source ? ` · ${item.source}` : ""}
        </div>
      </div>
    </div>
  );
}
