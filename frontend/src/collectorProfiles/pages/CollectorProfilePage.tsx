import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, ExternalLink } from "lucide-react";
import {
  fetchMyCollectorProfile,
  publishCollectorProfile,
  updateCollectorProfile,
} from "../api";

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

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }
  if (!data) return null;

  const { profile } = data;

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
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{profile.display_name}</h1>
          <p className="text-text-secondary">@{profile.username}</p>
        </div>
        <Link
          to={`/u/${profile.username}`}
          target="_blank"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          View public page <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      <label className="block">
        <span className="text-sm text-text-secondary">Bio</span>
        <textarea
          className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 min-h-[100px]"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
        />
      </label>

      <label className="block">
        <span className="text-sm text-text-secondary">Visibility</span>
        <select
          className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-raised px-3 py-2"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
        >
          <option value="private">Private — only you</option>
          <option value="unlisted">Unlisted — direct link only</option>
          <option value="public">Public — discoverable</option>
        </select>
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg border border-border-subtle hover:bg-surface-overlay"
        >
          Save
        </button>
        {profile.status !== "active" && (
          <button
            type="button"
            onClick={publish}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-accent text-white font-medium"
          >
            Publish profile
          </button>
        )}
      </div>

      <nav className="grid sm:grid-cols-3 gap-3 pt-4 border-t border-border-subtle">
        <Link to="/collector/cards" className="p-4 rounded-xl border border-border-subtle hover:border-accent/40">
          Cards
        </Link>
        <Link to="/collector/trades" className="p-4 rounded-xl border border-border-subtle hover:border-accent/40">
          Trades
        </Link>
        <Link to="/collector/messages" className="p-4 rounded-xl border border-border-subtle hover:border-accent/40">
          Messages
        </Link>
      </nav>
    </div>
  );
}
