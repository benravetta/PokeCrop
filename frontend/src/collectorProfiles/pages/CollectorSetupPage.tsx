import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { createCollectorProfile } from "../api";
import { useCollectorProfilesConfig } from "../hooks/useCollectorProfilesConfig";

export function CollectorSetupPage() {
  const navigate = useNavigate();
  const { enabled, loading: configLoading } = useCollectorProfilesConfig();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (configLoading) {
    return <div className="p-8 text-text-secondary">Loading…</div>;
  }
  if (!enabled) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <p className="text-text-secondary">Collector profiles are not available yet.</p>
        <Link to="/account" className="mt-4 inline-block text-accent hover:underline">
          Back to account
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createCollectorProfile({ username, displayName: displayName || username });
      navigate("/collector/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-text-primary">GemCheck Collector Profile</h1>
      <p className="mt-2 text-text-secondary">
        Show what you collect, list what you will trade and share it all with one link.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm text-text-secondary">Username</span>
          <input
            className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-raised px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="my_collection"
            required
          />
          <span className="text-xs text-text-secondary">gemcheck.co.uk/u/yourname</span>
        </label>
        <label className="block">
          <span className="text-sm text-text-secondary">Display name</span>
          <input
            className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-raised px-3 py-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your collector name"
          />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent text-white py-2.5 font-medium disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Create profile
        </button>
      </form>
    </div>
  );
}
