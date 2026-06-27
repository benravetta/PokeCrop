import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Share2 } from "lucide-react";
import { PublicProfileShell } from "../components/PublicProfileShell";
import { CollectorLoading, CollectorPageHeader } from "../components/ui";
import { CardSpecSheet, type CardSpecData } from "../components/CardSpecSheet";
import { fetchPublicCard, type PublicCardView } from "../api";
import { usePageSeo } from "../../lib/seo";

export function PublicCollectorCardPage() {
  const { username, publicCardId } = useParams<{ username: string; publicCardId: string }>();
  const [view, setView] = useState<PublicCardView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  usePageSeo({
    title: view ? `${view.card.cardName} — ${view.profile.displayName}` : "Card",
    description: view?.card.publicDescription ?? "Collector card on GemCheck",
    path: username && publicCardId ? `/u/${username}/cards/${publicCardId}` : "/u",
    robots: view?.seo.noIndex ? "noindex, nofollow" : undefined,
  });

  useEffect(() => {
    if (!username || !publicCardId) return;
    fetchPublicCard(username, publicCardId)
      .then(setView)
      .catch((e) => setError(e instanceof Error ? e.message : "Not found"))
      .finally(() => setLoading(false));
  }, [username, publicCardId]);

  if (loading) {
    return (
      <PublicProfileShell>
        <CollectorLoading label="Loading card…" />
      </PublicProfileShell>
    );
  }

  if (error || !view) {
    return (
      <PublicProfileShell>
        <div className="py-16 text-center">
          <p className="text-text-secondary">{error ?? "Card not found"}</p>
          {username && (
            <Link to={`/u/${username}`} className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
              Back to profile
            </Link>
          )}
        </div>
      </PublicProfileShell>
    );
  }

  const { card, images, profile } = view;
  const spec: CardSpecData = {
    cardName: card.cardName,
    cardGame: card.cardGame,
    setName: card.setName,
    setCode: card.setCode,
    cardNumber: card.cardNumber,
    releaseYear: card.releaseYear,
    language: card.language,
    variant: card.variant,
    rarity: card.rarity,
    finishType: card.finishType,
    edition: card.edition,
    condition: card.condition,
    cardState: card.cardState,
    gradingCompany: card.gradingCompany,
    officialGrade: card.officialGrade,
    certificationNumber: card.certificationNumber,
    publicDescription: card.publicDescription,
    tradeStatus: card.tradeStatus,
    tradeValueMinorUnits: card.tradeValueMinorUnits,
    tradeValueCurrency: card.tradeValueCurrency,
    identifiers: card.identifiers,
    identificationConfidence: card.identificationConfidence,
    frontDisplayUrl: images.frontDisplayUrl,
    backDisplayUrl: images.backDisplayUrl,
  };

  return (
    <PublicProfileShell showFooter={false}>
      <div className="mx-auto max-w-6xl space-y-8 anim-rise">
        <Link
          to={`/u/${profile.username}`}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {profile.displayName}
        </Link>

        <CollectorPageHeader title={card.cardName} />

        <CardSpecSheet spec={spec} />

        {view.viewerGradingAllowed && (
          <div className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
            <h3 className="text-sm font-semibold text-text-primary">Run your own pre-grade</h3>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              This grade is created for your account using the owner&apos;s published photos. It does not change or verify their listing.
            </p>
            <Link
              to="/login"
              state={{ from: window.location.pathname }}
              className="mt-4 inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_-6px_var(--color-accent)] hover:bg-accent-hover"
            >
              Grade this card
            </Link>
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            void navigator.share?.({ url: window.location.href, title: card.cardName })
          }
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary"
        >
          <Share2 className="h-4 w-4" />
          Share card
        </button>
      </div>
    </PublicProfileShell>
  );
}
