import { Link } from "react-router-dom";
import { Copy, Flag, Link2, MapPin, MessageSquare, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PublicProfileShell } from "../components/PublicProfileShell";
import {
  CollectorCardGrid,
  CollectorLoading,
  type CollectorCardPreview,
} from "../components/ui";
import { fetchPublicProfile, type PublicProfileView } from "../api";
import { usePageSeo } from "../../lib/seo";

export function PublicCollectorProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [view, setView] = useState<PublicProfileView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ url, title: view?.profile.displayName });
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <PublicProfileShell>
        <CollectorLoading label="Loading profile…" />
      </PublicProfileShell>
    );
  }

  if (error || !view) {
    return (
      <PublicProfileShell>
        <div className="py-16 text-center">
          <h1 className="text-xl font-semibold text-text-primary">Profile not found</h1>
          <p className="mt-2 text-text-secondary">{error ?? "This profile is unavailable."}</p>
          <Link to="/" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
            Back to GemCheck
          </Link>
        </div>
      </PublicProfileShell>
    );
  }

  const { profile } = view;

  return (
    <PublicProfileShell showFooter={false}>
      <div className="space-y-8 anim-rise">
        <header className="overflow-hidden rounded-3xl border border-border-subtle bg-surface-raised">
          <div
            className="h-36 sm:h-44 lg:h-52"
            style={{
              background:
                "linear-gradient(135deg, rgba(124,108,246,0.28) 0%, rgba(14,165,233,0.12) 45%, transparent 100%)",
            }}
          />
          <div className="px-5 pb-6 sm:px-8 sm:pb-8 lg:px-10">
            <div className="-mt-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-end gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-surface-raised bg-accent/15 text-2xl font-bold text-accent sm:h-24 sm:w-24">
                  {profile.displayName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 pb-1">
                  <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                    {profile.displayName}
                  </h1>
                  <p className="text-text-secondary">@{profile.username}</p>
                  {profile.locationRegion && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-text-muted">
                      <MapPin className="h-3.5 w-3.5" />
                      {profile.locationRegion}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void share()}
                  className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-overlay"
                >
                  {copied ? <Copy className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                  {copied ? "Link copied" : "Share"}
                </button>
                {profile.messagingEnabled !== false && (
                  <Link
                    to="/login"
                    state={{ from: `/u/${profile.username}` }}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_-6px_var(--color-accent)] hover:bg-accent-hover"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Message
                  </Link>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="mt-6 max-w-3xl text-base leading-relaxed text-text-primary">{profile.bio}</p>
            )}

            {view.links.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {view.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1.5 text-sm text-text-secondary hover:border-accent/40 hover:text-text-primary"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </header>

        {view.interests.length > 0 && (
          <section>
            <SectionLabel>Collecting interests</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {view.interests.map((i) => (
                <span
                  key={`${i.interest_type}-${i.interest_value}`}
                  className="rounded-full border border-border-subtle bg-surface-raised px-3 py-1.5 text-sm text-text-primary"
                >
                  {i.interest_value}
                </span>
              ))}
            </div>
          </section>
        )}

        <ProfileSection
          title="Showcase"
          subtitle="Highlighted cards from this collection"
          cards={view.showcase}
          username={profile.username}
        />
        <ProfileSection
          title="For trade"
          subtitle="Available to swap or sell"
          cards={view.forTrade}
          username={profile.username}
        />
        <ProfileSection
          title="Wanted"
          subtitle="Cards this collector is looking for"
          cards={view.wanted}
          username={profile.username}
        />

        <p className="flex items-center gap-2 border-t border-border-subtle pt-8 text-xs text-text-muted">
          <Flag className="h-3.5 w-3.5" />
          See something wrong?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in to report
          </Link>
        </p>
      </div>
    </PublicProfileShell>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{children}</h2>
  );
}

function ProfileSection({
  title,
  subtitle,
  cards,
  username,
}: {
  title: string;
  subtitle: string;
  cards: unknown[];
  username: string;
}) {
  if (!cards.length) return null;

  const mapped: CollectorCardPreview[] = (
    cards as { publicId: string; cardName: string; setName?: string; thumbnailUrl?: string }[]
  ).map((c) => ({
    publicId: c.publicId,
    cardName: c.cardName,
    setName: c.setName,
    thumbnailUrl: c.thumbnailUrl,
  }));

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
        <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
      </div>
      <CollectorCardGrid
        cards={mapped}
        linkTo={(c) => `/u/${username}/cards/${c.publicId}`}
      />
    </section>
  );
}
