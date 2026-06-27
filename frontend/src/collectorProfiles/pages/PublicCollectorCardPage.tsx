import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { MarketingPageShell } from "../../components/marketing/MarketingPageShell";
import { fetchPublicCard } from "../api";
import { usePageSeo } from "../../lib/seo";

export function PublicCollectorCardPage() {
  const { username, publicCardId } = useParams<{ username: string; publicCardId: string }>();
  const [view, setView] = useState<Awaited<ReturnType<typeof fetchPublicCard>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  usePageSeo({
    title: view ? `${view.card.cardName} — ${view.profile.displayName}` : "Card",
    description: view?.card.publicDescription ?? "Collector card on GemCheck",
    path:
      username && publicCardId ? `/u/${username}/cards/${publicCardId}` : "/u",
    robots: view?.seo.noIndex ? "noindex, nofollow" : undefined,
  });

  useEffect(() => {
    if (!username || !publicCardId) return;
    fetchPublicCard(username, publicCardId)
      .then(setView)
      .catch((e) => setError(e instanceof Error ? e.message : "Not found"));
  }, [username, publicCardId]);

  if (error || !view) {
    return (
      <MarketingPageShell>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-text-secondary">{error ?? "Loading…"}</p>
          {username && (
            <Link to={`/u/${username}`} className="mt-4 inline-block text-accent hover:underline">
              Back to profile
            </Link>
          )}
        </div>
      </MarketingPageShell>
    );
  }

  const { card, images, profile } = view;

  return (
    <MarketingPageShell>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to={`/u/${profile.username}`} className="text-sm text-accent hover:underline">
          ← {profile.displayName}
        </Link>
        <div className="mt-6 grid sm:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
            {images.frontUrl ? (
              <img src={images.frontUrl} alt="Front" className="w-full rounded-lg" />
            ) : (
              <div className="aspect-[3/4] bg-surface-overlay rounded-lg" />
            )}
          </div>
          <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
            {images.backUrl ? (
              <img src={images.backUrl} alt="Back" className="w-full rounded-lg" />
            ) : (
              <div className="aspect-[3/4] bg-surface-overlay rounded-lg flex items-center justify-center text-text-secondary text-sm">
                Back not available
              </div>
            )}
          </div>
        </div>
        <div className="mt-8">
          <h1 className="text-2xl font-semibold text-text-primary">{card.cardName}</h1>
          <p className="text-text-secondary">
            {[card.setName, card.cardNumber].filter(Boolean).join(" · ")}
          </p>
          {card.publicDescription && (
            <p className="mt-4 text-text-primary">{card.publicDescription}</p>
          )}
          {card.officialGrade && (
            <p className="mt-2 text-sm text-text-secondary">
              {card.gradingCompany} {card.officialGrade}
            </p>
          )}
          {view.viewerGradingAllowed && (
            <Link
              to="/login"
              className="mt-6 inline-flex px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium"
            >
              Grade this card
            </Link>
          )}
          <p className="mt-4 text-xs text-text-secondary max-w-lg">
            This grade will be created for your account using the images published by the card owner.
            It will not change or verify the owner&apos;s listing.
          </p>
        </div>
      </div>
    </MarketingPageShell>
  );
}
