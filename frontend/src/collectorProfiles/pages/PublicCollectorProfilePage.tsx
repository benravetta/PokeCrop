import { Link } from "react-router-dom";
import { Share2, MessageSquare, Flag } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MarketingPageShell } from "../../components/marketing/MarketingPageShell";
import { fetchPublicProfile, type PublicProfileView } from "../api";
import { usePageSeo } from "../../lib/seo";

export function PublicCollectorProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [view, setView] = useState<PublicProfileView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  usePageSeo({
    title: view ? `${view.profile.displayName} (@${view.profile.username})` : "Collector profile",
    description: view?.profile.bio ?? "GemCheck collector profile",
    path: username ? `/u/${username}` : "/u",
    robots: view?.seo.noIndex ? "noindex, nofollow" : undefined,
  });

  useEffect(() => {
    if (!username) return;
    fetchPublicProfile(username)
      .then(setView)
      .catch((e) => setError(e instanceof Error ? e.message : "Profile not found"))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <MarketingPageShell>
        <div className="max-w-4xl mx-auto px-4 py-16 text-text-secondary">Loading profile…</div>
      </MarketingPageShell>
    );
  }

  if (error || !view) {
    return (
      <MarketingPageShell>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-xl font-semibold text-text-primary">Profile not found</h1>
          <p className="mt-2 text-text-secondary">{error ?? "This profile is unavailable."}</p>
          <Link to="/" className="mt-6 inline-block text-accent hover:underline">
            Back to GemCheck
          </Link>
        </div>
      </MarketingPageShell>
    );
  }

  const { profile } = view;

  return (
    <MarketingPageShell>
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <header className="rounded-2xl border border-border-subtle bg-surface-raised overflow-hidden">
          <div className="h-32 sm:h-40 bg-gradient-to-r from-accent/20 to-accent/5" />
          <div className="px-6 pb-6 -mt-10">
            <div className="w-20 h-20 rounded-full bg-surface-overlay border-4 border-surface-raised" />
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-text-primary">{profile.displayName}</h1>
                <p className="text-text-secondary">@{profile.username}</p>
                {profile.bio && <p className="mt-3 text-text-primary max-w-xl">{profile.bio}</p>}
                {profile.locationRegion && (
                  <p className="mt-1 text-sm text-text-secondary">{profile.locationRegion}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border-subtle text-sm text-text-secondary hover:bg-surface-overlay"
                  onClick={() => navigator.share?.({ url: window.location.href, title: profile.displayName })}
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
                {profile.messagingEnabled !== false && (
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium"
                  >
                    <MessageSquare className="w-4 h-4" /> Message
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>

        {view.interests.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide">Collecting</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {view.interests.map((i) => (
                <span
                  key={`${i.interest_type}-${i.interest_value}`}
                  className="px-3 py-1 rounded-full bg-surface-overlay text-sm text-text-primary"
                >
                  {i.interest_value}
                </span>
              ))}
            </div>
          </section>
        )}

        <ProfileSection title="Showcase" cards={view.showcase} username={profile.username} />
        <ProfileSection title="For trade" cards={view.forTrade} username={profile.username} />
        <ProfileSection title="Wanted" cards={view.wanted} username={profile.username} />

        <p className="mt-12 text-xs text-text-secondary flex items-center gap-1">
          <Flag className="w-3 h-3" />
          See something wrong?{" "}
          <Link to="/login" className="text-accent hover:underline">
            Sign in to report
          </Link>
        </p>
      </div>
    </MarketingPageShell>
  );
}

function ProfileSection({
  title,
  cards,
  username,
}: {
  title: string;
  cards: unknown[];
  username: string;
}) {
  if (!cards.length) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {(cards as { publicId: string; cardName: string; setName?: string; thumbnailUrl?: string }[]).map(
          (card) => (
            <Link
              key={card.publicId}
              to={`/u/${username}/cards/${card.publicId}`}
              className="rounded-xl border border-border-subtle bg-surface-raised overflow-hidden hover:border-accent/40 transition-colors"
            >
              <div className="aspect-[3/4] bg-surface-overlay flex items-center justify-center">
                {card.thumbnailUrl ? (
                  <img src={card.thumbnailUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-text-secondary text-sm">No image</span>
                )}
              </div>
              <div className="p-3">
                <p className="font-medium text-sm text-text-primary truncate">{card.cardName}</p>
                {card.setName && (
                  <p className="text-xs text-text-secondary truncate">{card.setName}</p>
                )}
              </div>
            </Link>
          )
        )}
      </div>
    </section>
  );
}
