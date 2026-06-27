import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import {
  ExternalLink,
  Globe,
  LayoutGrid,
  MessageSquare,
  Repeat2,
  Sparkles,
  UserCircle,
} from "lucide-react";
import {
  fetchMyCollectorProfile,
  publishCollectorProfile,
  updateCollectorProfile,
} from "../api";
import { COLLECTOR_COPY, formatStatus } from "../copy";
import {
  CollectorButton,
  CollectorField,
  CollectorLinkButton,
  CollectorLoading,
  CollectorPageHeader,
  CollectorSection,
  CollectorSelect,
  CollectorStatusBadge,
  CollectorTextarea,
} from "../components/ui";

export function CollectorProfilePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchMyCollectorProfile>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState("private");

  useEffect(() => {
    fetchMyCollectorProfile()
      .then((d) => {
        setData(d);
        setBio(d.profile.bio ?? "");
        setVisibility(d.profile.visibility ?? "private");
      })
      .catch(() => navigate("/collector/setup"))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) return <CollectorLoading label="Loading your profile…" />;
  if (!data) return null;

  const { profile } = data;
  const isLive = profile.status === "active";

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateCollectorProfile({ bio, visibility });
      setData({ ...data, profile: updated.profile });
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    try {
      const updated = await publishCollectorProfile();
      setData({ ...data, profile: updated.profile });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <CollectorPageHeader
        title={profile.display_name}
        description={`@${profile.username} · ${COLLECTOR_COPY.tagline}`}
        actions={
          isLive ? (
            <a
              href={`/u/${profile.username}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface-raised px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-overlay"
            >
              View public page
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <CollectorStatusBadge tone="warning">
              {formatStatus(COLLECTOR_COPY.profileStatus, profile.status)}
            </CollectorStatusBadge>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <QuickLink
          to="/collector/cards"
          icon={<LayoutGrid className="h-5 w-5" />}
          label={COLLECTOR_COPY.nav.cards}
          hint="Manage listings and photos"
        />
        <QuickLink
          to="/collector/trades"
          icon={<Repeat2 className="h-5 w-5" />}
          label={COLLECTOR_COPY.nav.trades}
          hint="Review trade enquiries"
        />
        <QuickLink
          to="/collector/messages"
          icon={<MessageSquare className="h-5 w-5" />}
          label={COLLECTOR_COPY.nav.messages}
          hint="Chat with collectors"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <CollectorSection
          icon={<UserCircle className="h-4 w-4" />}
          title="Profile details"
          description="What visitors see on your public page"
        >
          <div className="space-y-4">
            <CollectorField label="Bio" hint="Up to 500 characters">
              <CollectorTextarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                placeholder="Tell collectors what you collect and what you are looking for…"
              />
            </CollectorField>

            <CollectorField
              label="Visibility"
              hint={COLLECTOR_COPY.visibility[visibility]?.hint}
            >
              <CollectorSelect value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                {Object.entries(COLLECTOR_COPY.visibility).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </CollectorSelect>
            </CollectorField>

            <div className="flex flex-wrap gap-3 pt-1">
              <CollectorButton onClick={save} loading={saving} variant="secondary">
                Save changes
              </CollectorButton>
              {!isLive && (
                <CollectorButton onClick={publish} loading={saving}>
                  Publish profile
                </CollectorButton>
              )}
            </div>
          </div>
        </CollectorSection>

        <div className="space-y-6">
          <CollectorSection
            icon={<Globe className="h-4 w-4" />}
            title="Public link"
            description="Share this URL on socials or in your bio"
          >
            <div className="rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-text-secondary break-all">
              gemcheck.co.uk/u/{profile.username}
            </div>
            {!isLive && (
              <p className="mt-3 text-xs text-text-muted">
                Publish your profile to make this link live for visitors.
              </p>
            )}
          </CollectorSection>

          <CollectorSection
            icon={<Sparkles className="h-4 w-4" />}
            title="Getting started"
            description="Build out your collector presence"
          >
            <ol className="space-y-3 text-sm text-text-secondary">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                  1
                </span>
                <span>Add cards with front and back photos</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                  2
                </span>
                <span>Assign sections — showcase, for trade, or wanted</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                  3
                </span>
                <span>Publish cards, then publish your profile</span>
              </li>
            </ol>
            <div className="mt-5">
              <CollectorLinkButton to="/collector/cards/new">Add your first card</CollectorLinkButton>
            </div>
          </CollectorSection>
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  to,
  icon,
  label,
  hint,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-border-subtle bg-surface-raised p-4 transition hover:border-accent/40 hover:bg-surface-overlay/40"
    >
      <div className="flex items-center gap-3 text-accent">{icon}</div>
      <p className="mt-3 font-semibold text-text-primary">{label}</p>
      <p className="mt-1 text-xs text-text-muted">{hint}</p>
    </Link>
  );
}
